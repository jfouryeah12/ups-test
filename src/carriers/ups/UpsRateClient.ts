import {
  RateRequestSchema,
  type RateQuote,
  type RateRequest,
} from "../../domain/models";
import { CarrierError } from "../../errors/CarrierError";
import { config } from "../../config";
import { HttpClient } from "../../transport/HttpClient";
import { UpsAuthClient } from "./UpsAuthClient";

export class UpsRateClient {
  constructor(
    private http: HttpClient,
    private auth: UpsAuthClient,
  ) {}

  async rateShop(req: RateRequest): Promise<RateQuote[]> {
    const parsed = RateRequestSchema.safeParse(req);
    if (!parsed.success) {
      throw new CarrierError({
        code: "VALIDATION_FAILED",
        message: "Invalid rate request",
        carrier: "UPS",
        retryable: false,
        details: parsed.error.flatten(),
      });
    }

    const token = await this.auth.getToken();

    // Minimal UPS-like request shape (stubbed correctness; refine per docs later)
    const upsPayload = {
      RateRequest: {
        Shipment: {
          Shipper: { Address: mapAddr(req.origin) },
          ShipTo: { Address: mapAddr(req.destination) },
          Package: [
            {
              PackagingType: { Code: "02" },
              Dimensions: {
                UnitOfMeasurement: { Code: "CM" },
                Length: String(req.parcel.lengthCm),
                Width: String(req.parcel.widthCm),
                Height: String(req.parcel.heightCm),
              },
              PackageWeight: {
                UnitOfMeasurement: { Code: "KGS" },
                Weight: String(req.parcel.weightKg),
              },
            },
          ],
        },
      },
    };

    const url = `${config.UPS_BASE_URL}/api/rating/v1/Rate`;
    const res = await this.http.post(url, {
      headers: { authorization: `Bearer ${token}` },
      body: JSON.stringify(upsPayload),
      timeoutMs: config.HTTP_TIMEOUT_MS,
    });

    if (res.status === 429) {
      throw new CarrierError({
        code: "RATE_LIMITED",
        message: "UPS rate limited",
        carrier: "UPS",
        httpStatus: 429,
        retryable: true,
        details: res.jsonText,
      });
    }
    if (res.status === 401 || res.status === 403) {
      throw new CarrierError({
        code: "AUTH_FAILED",
        message: "UPS unauthorized",
        carrier: "UPS",
        httpStatus: res.status,
        retryable: false,
        details: res.jsonText,
      });
    }
    if (res.status < 200 || res.status >= 300) {
      throw new CarrierError({
        code: res.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST",
        message: "UPS rate request failed",
        carrier: "UPS",
        httpStatus: res.status,
        retryable: res.status >= 500,
        details: res.jsonText,
      });
    }

    let body: any;
    try {
      body = JSON.parse(res.jsonText);
    } catch {
      throw new CarrierError({
        code: "MALFORMED_RESPONSE",
        message: "UPS rate response was not valid JSON",
        carrier: "UPS",
        retryable: true,
        details: res.jsonText,
      });
    }

    // Normalize: adapt this to match the doc payload you stub in tests
    const rated = body?.RateResponse?.RatedShipment;
    if (!Array.isArray(rated)) {
      throw new CarrierError({
        code: "MALFORMED_RESPONSE",
        message: "UPS rate response missing RatedShipment",
        carrier: "UPS",
        retryable: true,
        details: body,
      });
    }

    return rated.map((r: any) => ({
      carrier: "UPS",
      serviceLevel: String(r?.Service?.Code ?? "UNKNOWN"),
      totalCharge: {
        currency: String(r?.TotalCharges?.CurrencyCode ?? "USD"),
        amount: Number(r?.TotalCharges?.MonetaryValue ?? 0),
      },
      deliveryDays: r?.GuaranteedDelivery?.BusinessDaysInTransit
        ? Number(r.GuaranteedDelivery.BusinessDaysInTransit)
        : undefined,
    }));
  }
}

function mapAddr(a: any) {
  return {
    AddressLine: [a.street1, a.street2].filter(Boolean),
    City: a.city,
    StateProvinceCode: a.state,
    PostalCode: a.postalCode,
    CountryCode: a.countryCode,
  };
}

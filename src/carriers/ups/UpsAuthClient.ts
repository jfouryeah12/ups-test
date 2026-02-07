import { config } from "../../config";
import { CarrierError } from "../../errors/CarrierError";
import { HttpClient } from "../../transport/HttpClient";

type TokenCache = { token: string; expiresAtMs: number } | null;

export class UpsAuthClient {
  private cache: TokenCache = null;
  constructor(private http: HttpClient) {}

  async getToken(): Promise<string> {
    const now = Date.now();
    if (this.cache && now < this.cache.expiresAtMs - 15_000) return this.cache.token; // 15s skew

    const basic = Buffer.from(`${config.UPS_CLIENT_ID}:${config.UPS_CLIENT_SECRET}`).toString("base64");
    const res = await this.http.post(config.UPS_OAUTH_URL, {
      headers: {
        authorization: `Basic ${basic}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      timeoutMs: config.HTTP_TIMEOUT_MS,
    });

    if (res.status < 200 || res.status >= 300) {
      throw new CarrierError({
        code: "AUTH_FAILED",
        message: "UPS auth failed",
        carrier: "UPS",
        httpStatus: res.status,
        retryable: res.status >= 500,
        details: res.jsonText,
      });
    }

    let parsed: any;
    try {
      parsed = JSON.parse(res.jsonText);
    } catch {
      throw new CarrierError({
        code: "MALFORMED_RESPONSE",
        message: "UPS token response was not valid JSON",
        carrier: "UPS",
        retryable: true,
        details: res.jsonText,
      });
    }

    const token = parsed.access_token;
    const expiresIn = Number(parsed.expires_in ?? 0);
    if (!token || !expiresIn) {
      throw new CarrierError({
        code: "MALFORMED_RESPONSE",
        message: "UPS token response missing fields",
        carrier: "UPS",
        retryable: true,
        details: parsed,
      });
    }

    this.cache = { token, expiresAtMs: now + expiresIn * 1000 };
    return token;
  }
}

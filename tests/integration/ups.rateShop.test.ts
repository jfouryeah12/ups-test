import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import nock from "nock";
import fs from "fs";
import path from "path";
import { createUpsClient } from "../../src/carriers/ups";
import { CarrierError } from "../../src/errors/CarrierError";
import { config } from "../../src/config";

// Load fixtures
function loadFixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, "../fixtures", name), "utf-8");
}

const fixtures = {
  tokenSuccess: JSON.parse(loadFixture("upsToken.success.json")),
  rateSuccess: JSON.parse(loadFixture("upsRate.success.json")),
  rateLimited: JSON.parse(loadFixture("upsRate.rateLimited.json")),
  unauthorized: JSON.parse(loadFixture("upsRate.unauthorized.json")),
  malformed: loadFixture("upsRate.malformed.txt"),
};

describe("UPS Rate Shop Integration", () => {
  const authUrl = new URL(config.UPS_OAUTH_URL);
  const rateUrl = new URL(config.UPS_BASE_URL);

  beforeEach(() => {
    nock.cleanAll();
    vi.useFakeTimers();
  });

  afterEach(() => {
    nock.cleanAll();
    vi.useRealTimers();
  });

  const rateRequest = {
    origin: {
      street1: "123 Origin St",
      city: "Origin City",
      state: "NY",
      postalCode: "10001",
      countryCode: "US",
    },
    destination: {
      street1: "456 Dest St",
      city: "Dest City",
      state: "CA",
      postalCode: "90210",
      countryCode: "US",
    },
    parcel: {
      weightKg: 5,
      lengthCm: 30,
      widthCm: 20,
      heightCm: 10,
    },
  };

  it("should successfully shop for rates (auth + rate request mapping)", async () => {
    // Mock Auth
    const authScope = nock(authUrl.origin)
      .post(authUrl.pathname, "grant_type=client_credentials")
      .basicAuth({ user: config.UPS_CLIENT_ID, pass: config.UPS_CLIENT_SECRET })
      .reply(200, fixtures.tokenSuccess);

    // Mock Rate
    const rateScope = nock(rateUrl.origin)
      .post("/api/rating/v1/Rate", (body) => {
        // Assert request mapping
        const shipment = body.RateRequest.Shipment;
        return (
          shipment.Shipper.Address.PostalCode === "10001" &&
          shipment.ShipTo.Address.PostalCode === "90210" &&
          shipment.Package[0].PackageWeight.Weight === "5" &&
          shipment.Package[0].Dimensions.Length === "30"
        );
      })
      .matchHeader("authorization", "Bearer mock_token_123456789")
      .reply(200, fixtures.rateSuccess);

    const client = createUpsClient();
    const quotes = await client.rateShop(rateRequest);

    expect(authScope.isDone()).toBe(true);
    expect(rateScope.isDone()).toBe(true);

    // Assert response normalization
    expect(quotes).toHaveLength(2);
    expect(quotes[0]).toEqual({
      carrier: "UPS",
      serviceLevel: "03",
      totalCharge: { currency: "USD", amount: 15.5 },
      deliveryDays: 2,
    });
    expect(quotes[1]).toEqual({
      carrier: "UPS",
      serviceLevel: "02",
      totalCharge: { currency: "USD", amount: 25.0 },
      deliveryDays: 1,
    });
  });

  it("should reuse cached token for subsequent requests", async () => {
    const client = createUpsClient();

    // 1st Call: Auth + Rate
    nock(authUrl.origin)
      .post(authUrl.pathname)
      .reply(200, fixtures.tokenSuccess);
    
    nock(rateUrl.origin)
      .post("/api/rating/v1/Rate")
      .reply(200, fixtures.rateSuccess);

    await client.rateShop(rateRequest);

    // 2nd Call: Rate only (no Auth)
    const rateScope2 = nock(rateUrl.origin)
      .post("/api/rating/v1/Rate")
      .matchHeader("authorization", "Bearer mock_token_123456789")
      .reply(200, fixtures.rateSuccess);
    
    // Ensure no new auth calls
    const authScope2 = nock(authUrl.origin)
        .post(authUrl.pathname)
        .reply(500, "Should not be called");

    await client.rateShop(rateRequest);

    expect(rateScope2.isDone()).toBe(true);
    expect(authScope2.isDone()).toBe(false); // Should remain pending/unused
  });

  it("should refresh token if expired", async () => {
    const client = createUpsClient();

    // 1st Call: Auth (expires in 3599s)
    nock(authUrl.origin)
      .post(authUrl.pathname)
      .reply(200, fixtures.tokenSuccess);
    
    nock(rateUrl.origin)
      .post("/api/rating/v1/Rate")
      .reply(200, fixtures.rateSuccess);

    await client.rateShop(rateRequest);

    // Advance time beyond expiration (3600s + 1s)
    vi.advanceTimersByTime(3601 * 1000);

    // 2nd Call: Should re-auth
    const authScope2 = nock(authUrl.origin)
      .post(authUrl.pathname)
      .reply(200, { ...fixtures.tokenSuccess, access_token: "new_token" });

    const rateScope2 = nock(rateUrl.origin)
      .post("/api/rating/v1/Rate")
      .matchHeader("authorization", "Bearer new_token")
      .reply(200, fixtures.rateSuccess);

    await client.rateShop(rateRequest);

    expect(authScope2.isDone()).toBe(true);
    expect(rateScope2.isDone()).toBe(true);
  });

  it("should handle 429 Rate Limit", async () => {
    // Auth success
    nock(authUrl.origin)
        .post(authUrl.pathname)
        .reply(200, fixtures.tokenSuccess);

    // Rate limit
    nock(rateUrl.origin)
      .post("/api/rating/v1/Rate")
      .reply(429, fixtures.rateLimited);

    const client = createUpsClient();

    await expect(client.rateShop(rateRequest)).rejects.toMatchObject({
      code: "RATE_LIMITED",
      retryable: true,
      carrier: "UPS",
    });
  });

  it("should handle 401 Unauthorized", async () => {
    // Auth success (initially)
    nock(authUrl.origin)
        .post(authUrl.pathname)
        .reply(200, fixtures.tokenSuccess);

    // Rate: 401
    nock(rateUrl.origin)
      .post("/api/rating/v1/Rate")
      .reply(401, fixtures.unauthorized);

    const client = createUpsClient();

    await expect(client.rateShop(rateRequest)).rejects.toMatchObject({
      code: "AUTH_FAILED",
      retryable: false,
      carrier: "UPS",
    });
  });

  it("should handle Malformed Response", async () => {
      // Auth success
      nock(authUrl.origin)
         .post(authUrl.pathname)
         .reply(200, fixtures.tokenSuccess);
 
      // Rate: 200 but bad body
      nock(rateUrl.origin)
        .post("/api/rating/v1/Rate")
        .reply(200, fixtures.malformed); // "Bad Gateway" string
 
     const client = createUpsClient();
 
     await expect(client.rateShop(rateRequest)).rejects.toMatchObject({
       code: "MALFORMED_RESPONSE",
       retryable: true,
       carrier: "UPS",
     });
   });
});

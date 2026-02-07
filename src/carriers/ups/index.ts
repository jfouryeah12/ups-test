import { HttpClient } from "../../transport/HttpClient";
import { UpsAuthClient } from "./UpsAuthClient";
import { UpsRateClient } from "./UpsRateClient";
import type { CarrierClient } from "../types";

export function createUpsClient(http = new HttpClient()): CarrierClient {
  const auth = new UpsAuthClient(http);
  const rate = new UpsRateClient(http, auth);

  return {
    rateShop: (req) => rate.rateShop(req),
  };
}

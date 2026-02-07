import type { RateRequest, RateQuote } from "../domain/models";

export interface CarrierClient {
  rateShop(req: RateRequest): Promise<RateQuote[]>;
  // future:
  // createLabel(...): Promise<...>
  // track(...): Promise<...>
}

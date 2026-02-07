export type CarrierErrorCode =
  | "VALIDATION_FAILED"
  | "AUTH_FAILED"
  | "RATE_LIMITED"
  | "BAD_REQUEST"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "MALFORMED_RESPONSE";

export class CarrierError extends Error {
  public readonly code: CarrierErrorCode;
  public readonly carrier: string;
  public readonly httpStatus?: number | undefined;
  public readonly retryable: boolean;
  public readonly details?: unknown;

  constructor(opts: {
    code: CarrierErrorCode;
    message: string;
    carrier: string;
    httpStatus?: number;
    retryable: boolean;
    details?: unknown;
  }) {
    super(opts.message);
    this.name = "CarrierError";
    this.code = opts.code;
    this.carrier = opts.carrier;
    this.httpStatus = opts.httpStatus;
    this.retryable = opts.retryable;
    this.details = opts.details;
  }
}

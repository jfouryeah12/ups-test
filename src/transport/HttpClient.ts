import { CarrierError } from "../errors/CarrierError";

export type HttpResponse = { status: number; jsonText: string };

export class HttpClient {
  async post(url: string, opts: { headers?: Record<string, string>; body: string; timeoutMs: number }): Promise<HttpResponse> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), opts.timeoutMs);

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(opts.headers ?? {}) },
        body: opts.body,
        signal: controller.signal,
      });

      const jsonText = await res.text();
      return { status: res.status, jsonText };
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new CarrierError({
          code: "TIMEOUT",
          message: "Network timeout",
          carrier: "TRANSPORT",
          retryable: true,
        });
      }
      throw new CarrierError({
        code: "UPSTREAM_ERROR",
        message: "Network error",
        carrier: "TRANSPORT",
        retryable: true,
        details: String(e),
      });
    } finally {
      clearTimeout(t);
    }
  }
}

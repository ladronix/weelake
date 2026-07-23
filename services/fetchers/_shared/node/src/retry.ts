import type { Logger } from "./logger";

/**
 * retry — exponential backoff with full jitter, capped at 3
 * attempts by default.
 *
 * Retriable failures: 5xx, 429, network errors (fetch threw).
 * Not retriable: 4xx (the request is malformed; retry won't help).
 *
 * Caller passes a `fn` that returns Response (from fetch()) or
 * throws. We inspect `res.status` when a Response comes back.
 * Non-Response returns are treated as success.
 *
 * One `http.retry` log entry per retry attempt so a rate-limited
 * upstream is visible in the fetcher logs without extra
 * instrumentation.
 */
export interface RetryOpts {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  log?: Logger;
  label?: string;
}

const isRetriableStatus = (s: number) => s === 429 || s >= 500;

function jitterDelay(attempt: number, base: number, max: number): number {
  const raw = Math.min(max, base * Math.pow(3, attempt - 1));
  return Math.floor(Math.random() * raw); // full jitter
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function retry<T>(fn: () => Promise<T>, opts: RetryOpts = {}): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const base = opts.baseDelayMs ?? 1000;
  const max = opts.maxDelayMs ?? 10000;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const result = await fn();
      // If the fn returned a Response, treat non-2xx as maybe-retriable.
      if (result instanceof Response && !result.ok) {
        if (!isRetriableStatus(result.status) || attempt === attempts) return result;
        const delay = jitterDelay(attempt, base, max);
        opts.log?.warn({
          event: "http.retry",
          label: opts.label,
          attempt,
          status: result.status,
          delay_ms: delay,
        });
        await sleep(delay);
        continue;
      }
      return result;
    } catch (e) {
      lastError = e;
      if (attempt === attempts) throw e;
      const delay = jitterDelay(attempt, base, max);
      opts.log?.warn({
        event: "http.retry",
        label: opts.label,
        attempt,
        message: e instanceof Error ? e.message : String(e),
        delay_ms: delay,
      });
      await sleep(delay);
    }
  }
  throw lastError;
}

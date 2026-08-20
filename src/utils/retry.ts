/**
 * Retry helpers for flaky upstream providers (Twilio, ElevenLabs, AssemblyAI,
 * Google Calendar, ATS). Exponential backoff with jitter, capped attempts.
 */
import { logger } from "@/utils/logger";

export type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  scope?: string;
  /** Return false to stop retrying immediately (e.g. 4xx client errors). */
  shouldRetry?: (error: unknown, attempt: number) => boolean;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const attempts = Math.max(1, options.attempts ?? 3);
  const base = options.baseDelayMs ?? 400;
  const max = options.maxDelayMs ?? 4000;
  const scope = options.scope ?? "operation";

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const retryable = options.shouldRetry ? options.shouldRetry(error, attempt) : true;
      if (!retryable || attempt === attempts) break;
      const delay = Math.min(max, base * 2 ** (attempt - 1)) + Math.floor(Math.random() * 150);
      logger.warn(`${scope} attempt ${attempt} failed, retrying in ${delay}ms`, error);
      await sleep(delay);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/** fetch() with retries on network errors, 408, 429 and 5xx responses. */
export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  return withRetry(
    async () => {
      const res = await fetch(input, init);
      if (res.status === 408 || res.status === 429 || res.status >= 500) {
        throw new Error(`Upstream responded ${res.status}`);
      }
      return res;
    },
    { scope: options.scope ?? "fetch", ...options },
  );
}

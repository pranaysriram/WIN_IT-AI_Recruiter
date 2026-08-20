import { getAdminClient } from "@/db/connection";
import { logger } from "@/utils/logger";

export type RateLimitResult = { allowed: boolean; remaining: number; retryAfter: number };

/**
 * Fixed-window rate limiter backed by `api_rate_limits`.
 * Fails open (allows the request) if the counter store is unreachable, so a
 * database hiccup never drops legitimate webhook deliveries.
 */
export async function checkRateLimit(
  key: string,
  limit = 60,
  windowSeconds = 60,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowStart = new Date(Math.floor(now / (windowSeconds * 1000)) * windowSeconds * 1000);
  const retryAfter = Math.ceil((windowStart.getTime() + windowSeconds * 1000 - now) / 1000);

  try {
    const supabase = await getAdminClient();
    const { data: existing } = await supabase
      .from("api_rate_limits")
      .select("id, hits")
      .eq("bucket_key", key)
      .eq("window_start", windowStart.toISOString())
      .maybeSingle();

    if (!existing) {
      await supabase
        .from("api_rate_limits")
        .insert({ bucket_key: key, window_start: windowStart.toISOString(), hits: 1 });
      return { allowed: true, remaining: limit - 1, retryAfter };
    }

    const hits = existing.hits + 1;
    await supabase.from("api_rate_limits").update({ hits }).eq("id", existing.id);
    return { allowed: hits <= limit, remaining: Math.max(0, limit - hits), retryAfter };
  } catch (error) {
    logger.warn("rate limiter unavailable, allowing request", error);
    return { allowed: true, remaining: limit, retryAfter };
  }
}

export function clientKey(request: Request, scope: string): string {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return `${scope}:${ip}`;
}

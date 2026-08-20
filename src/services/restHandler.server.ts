/**
 * Shared plumbing for the `/api/*` REST surface.
 *
 * Every REST route goes through `restRoute`, which applies (in order):
 * rate limiting -> bearer authentication (RLS-scoped client) -> handler ->
 * CORS + security headers, with errors normalised by `jsonError`.
 *
 * No business logic lives here: handlers delegate to the existing services and
 * controllers.
 */
import type { DB } from "@/db/connection";
import { authenticateRequest, jsonError, HttpError } from "@/services/callApiService.server";
import { checkRateLimit, clientKey } from "@/middleware/rateLimiter.server";
import { preflight, withSecurityHeaders } from "@/middleware/security";
import { recordAudit, requestMeta } from "@/middleware/audit.server";

export { preflight, HttpError };

export type RestContext = { request: Request; supabase: DB };

/** Wraps a REST handler with rate limiting, auth and security headers. */
export async function restRoute(
  request: Request,
  scope: string,
  handler: (ctx: RestContext) => Promise<Response>,
  options: { limit?: number; windowSeconds?: number } = {},
): Promise<Response> {
  try {
    const limit = await checkRateLimit(
      clientKey(request, scope),
      options.limit ?? 120,
      options.windowSeconds ?? 60,
    );
    if (!limit.allowed) {
      return withSecurityHeaders(
        request,
        Response.json(
          { error: "Too many requests" },
          { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
        ),
      );
    }

    const supabase = await authenticateRequest(request);
    return withSecurityHeaders(request, await handler({ request, supabase }));
  } catch (e) {
    return withSecurityHeaders(request, jsonError(e));
  }
}

/** Parses and validates a JSON body, raising a 400 on malformed input. */
export async function readJson<T>(request: Request, parse: (value: unknown) => T): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  try {
    return parse(raw);
  } catch (e) {
    throw new HttpError(422, e instanceof Error ? e.message : "Invalid request body");
  }
}

/** Audit helper for state-changing REST calls. */
export async function auditRest(
  request: Request,
  entry: {
    action: string;
    resourceType: string;
    resourceId?: string | null;
    status?: "success" | "failure" | "denied";
    details?: Record<string, unknown>;
  },
): Promise<void> {
  await recordAudit({ ...entry, ...requestMeta(request) });
}

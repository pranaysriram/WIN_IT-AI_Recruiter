import { createFileRoute } from "@tanstack/react-router";
import { authenticateRequest, getCallRecording, jsonError } from "@/services/callApiService.server";
import { uuid } from "@/utils/validation";
import { checkRateLimit, clientKey } from "@/middleware/rateLimiter.server";
import { preflight, withSecurityHeaders } from "@/middleware/security";

export const Route = createFileRoute("/api/calls/$id/recording")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),
      GET: async ({ request, params }) => {
        try {
          const limit = await checkRateLimit(clientKey(request, "calls-recording"), 120, 60);
          if (!limit.allowed) {
            return withSecurityHeaders(
              request,
              Response.json({ error: "Too many requests" }, {
                status: 429,
                headers: { "Retry-After": String(limit.retryAfter) },
              }),
            );
          }
          const parsed = uuid.safeParse(params.id);
          if (!parsed.success) return withSecurityHeaders(request, Response.json({ error: "Invalid call id" }, { status: 400 }));
          const supabase = await authenticateRequest(request);
          return withSecurityHeaders(request, await getCallRecording(supabase, parsed.data));
        } catch (e) {
          return withSecurityHeaders(request, jsonError(e));
        }
      },
    },
  },
});

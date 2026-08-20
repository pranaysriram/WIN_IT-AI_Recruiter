import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticateRequest, initiateCall, jsonError } from "@/services/callApiService.server";
import { uuid } from "@/utils/validation";
import { checkRateLimit, clientKey } from "@/middleware/rateLimiter.server";
import { preflight, withSecurityHeaders } from "@/middleware/security";
import { recordAudit, requestMeta } from "@/middleware/audit.server";

const bodySchema = z.object({ candidateId: uuid, jobId: uuid.nullable().optional() });

export const Route = createFileRoute("/api/calls/initiate")({
  server: {
    handlers: {
      OPTIONS: async ({ request }) => preflight(request),
      POST: async ({ request }) => {
        const meta = requestMeta(request);
        try {
          const limit = await checkRateLimit(clientKey(request, "calls-initiate"), 30, 60);
          if (!limit.allowed) {
            return withSecurityHeaders(
              request,
              Response.json({ error: "Too many requests" }, {
                status: 429,
                headers: { "Retry-After": String(limit.retryAfter) },
              }),
            );
          }

          const supabase = await authenticateRequest(request);
          const parsed = bodySchema.safeParse(await request.json().catch(() => null));
          if (!parsed.success) {
            return withSecurityHeaders(
              request,
              Response.json({ error: "candidateId (uuid) is required" }, { status: 400 }),
            );
          }
          const result = await initiateCall(supabase, parsed.data);
          const { data: auth } = await supabase.auth.getUser();
          await recordAudit({
            actorId: auth.user?.id ?? null,
            actorEmail: auth.user?.email ?? null,
            action: "call.initiate",
            resourceType: "candidate",
            resourceId: parsed.data.candidateId,
            ...meta,
          });
          return withSecurityHeaders(request, Response.json(result, { status: 202 }));
        } catch (e) {
          await recordAudit({
            action: "call.initiate",
            status: "failure",
            details: { message: e instanceof Error ? e.message : "unknown" },
            ...meta,
          });
          return withSecurityHeaders(request, jsonError(e));
        }
      },
    },
  },
});

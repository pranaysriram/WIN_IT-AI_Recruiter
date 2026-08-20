import { createFileRoute } from "@tanstack/react-router";
import { ingestPostCall, verifyWebhookSignature } from "@/services/elevenLabsService.server";
import type { PostCallPayload } from "@/services/elevenLabsService.server";
import { checkRateLimit, clientKey } from "@/middleware/rateLimiter.server";
import { recordAudit, requestMeta } from "@/middleware/audit.server";
import { SECURITY_HEADERS } from "@/middleware/security";

export const Route = createFileRoute("/api/public/elevenlabs-call")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["ELEVENLABS_WEBHOOK_SECRET"];
        if (!secret) return new Response("Webhook not configured", { status: 503 });

        const limit = await checkRateLimit(clientKey(request, "elevenlabs-webhook"), 120, 60);
        if (!limit.allowed) {
          return new Response("Too many requests", {
            status: 429,
            headers: { "Retry-After": String(limit.retryAfter) },
          });
        }

        const rawBody = await request.text();
        const signature = request.headers.get("elevenlabs-signature");
        const valid = await verifyWebhookSignature(rawBody, signature, secret);
        if (!valid) {
          await recordAudit({
            action: "webhook.elevenlabs",
            status: "denied",
            details: { reason: "invalid signature" },
            ...requestMeta(request),
          });
          return new Response("Invalid signature", { status: 401, headers: SECURITY_HEADERS });
        }

        let payload: PostCallPayload;
        try {
          payload = JSON.parse(rawBody) as PostCallPayload;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (payload.type && payload.type !== "post_call_transcription") {
          return Response.json({ ignored: payload.type });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const result = await ingestPostCall(supabaseAdmin, payload);
        await recordAudit({
          action: "webhook.elevenlabs",
          status: result.ok ? "success" : "failure",
          resourceType: "call_session",
          ...requestMeta(request),
        });
        return Response.json(result, { status: result.ok ? 200 : 202, headers: SECURITY_HEADERS });
      },
    },
  },
});

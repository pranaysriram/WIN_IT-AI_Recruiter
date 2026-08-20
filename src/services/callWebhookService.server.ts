/**
 * Shared webhook ingestion for call events.
 *
 * Handles two payload shapes:
 *  - ElevenLabs post-call transcription (JSON, HMAC-signed)
 *  - Twilio status callbacks (application/x-www-form-urlencoded)
 */
import { ingestPostCall, verifyWebhookSignature } from "@/services/elevenLabsService.server";
import type { PostCallPayload } from "@/services/elevenLabsService.server";
import { checkRateLimit, clientKey } from "@/middleware/rateLimiter.server";
import { twilioRequestUrl, verifyTwilioSignature } from "@/services/twilioSignature.server";
import { recordAudit, requestMeta } from "@/middleware/audit.server";
import { withSecurityHeaders } from "@/middleware/security";
import { logger } from "@/utils/logger";

const TWILIO_STATUS_MAP: Record<string, string> = {
  queued: "queued",
  initiated: "dialing",
  ringing: "dialing",
  "in-progress": "in_progress",
  completed: "completed",
  busy: "no_answer",
  "no-answer": "no_answer",
  failed: "failed",
  canceled: "failed",
};

export async function handleCallWebhook(request: Request): Promise<Response> {
  const limit = await checkRateLimit(clientKey(request, "calls-webhook"), 120, 60);
  if (!limit.allowed) {
    return withSecurityHeaders(
      request,
      new Response("Too many requests", {
        status: 429,
        headers: { "Retry-After": String(limit.retryAfter) },
      }),
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  const rawBody = await request.text();

  // --- Twilio status callback ---------------------------------------------
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = new URLSearchParams(rawBody);
    const meta = requestMeta(request);

    // Signature validation happens before anything reads the payload.
    const authToken = process.env["TWILIO_AUTH_TOKEN"];
    if (!authToken) {
      logger.error("TWILIO_AUTH_TOKEN missing; rejecting Twilio webhook");
      return withSecurityHeaders(request, new Response("Webhook not configured", { status: 503 }));
    }

    const signature = request.headers.get("x-twilio-signature");
    const valid = await verifyTwilioSignature({
      authToken,
      url: twilioRequestUrl(request),
      params: form,
      signature,
    });
    if (!valid) {
      await recordAudit({
        action: "twilio.webhook.signature_denied",
        resourceType: "call_session",
        resourceId: form.get("CallSid"),
        status: "denied",
        details: { reason: signature ? "invalid_signature" : "missing_signature" },
        ...meta,
      });
      return withSecurityHeaders(request, new Response("Invalid signature", { status: 401 }));
    }

    const callSid = form.get("CallSid");
    const twilioStatus = form.get("CallStatus");
    if (!callSid || !twilioStatus)
      return withSecurityHeaders(request, new Response("Invalid payload", { status: 400 }));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mapped = TWILIO_STATUS_MAP[twilioStatus] ?? "in_progress";
    const terminal = mapped === "completed" || mapped === "failed" || mapped === "no_answer";
    const recordingUrl = form.get("RecordingUrl");

    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({
        call_status: mapped,
        ...(terminal ? { call_end_time: new Date().toISOString() } : {}),
        ...(recordingUrl ? { recording_url: `${recordingUrl}.mp3` } : {}),
      })
      .eq("external_call_id", callSid);
    if (error) logger.error("Twilio status update failed", error.message);

    await recordAudit({
      action: "twilio.webhook.status",
      resourceType: "call_session",
      resourceId: callSid,
      status: error ? "failure" : "success",
      details: { twilio_status: twilioStatus, mapped },
      ...meta,
    });

    return withSecurityHeaders(
      request,
      new Response("<Response/>", {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      }),
    );
  }


  // --- ElevenLabs post-call transcription ----------------------------------
  const secret = process.env["ELEVENLABS_WEBHOOK_SECRET"];
  if (!secret) return new Response("Webhook not configured", { status: 503 });

  const signature = request.headers.get("elevenlabs-signature");
  const valid = await verifyWebhookSignature(rawBody, signature, secret);
  if (!valid) return new Response("Invalid signature", { status: 401 });

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
  return Response.json(result, { status: result.ok ? 200 : 202 });
}

/**
 * REST-facing call service (Phase 3 — Twilio calling).
 *
 * Shared by the `/api/calls/*` HTTP routes. Mirrors an Express
 * `services/callService.js`: authentication, call placement, status lookup and
 * recording retrieval, all against the Supabase-backed call log.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { DB } from "@/db/connection";
import { placeOutboundCall, requireElevenLabsKey } from "@/services/elevenLabsService.server";
import { toDialableNumber } from "@/services/twilioService.server";
import { logger } from "@/utils/logger";

const API_BASE = "https://api.elevenlabs.io";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function jsonError(e: unknown) {
  if (e instanceof HttpError) {
    return Response.json({ error: e.message }, { status: e.status });
  }
  const message = e instanceof Error ? e.message : "Unexpected error";
  logger.error("calls api error", message);
  return Response.json({ error: message }, { status: 500 });
}

/** Builds an RLS-scoped Supabase client from the request's bearer token. */
export async function authenticateRequest(request: Request): Promise<DB> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "Missing bearer token");

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new HttpError(503, "Backend is not configured");

  const supabase = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        h.set("apikey", key);
        h.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers: h });
      },
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Invalid or expired session");
  return supabase as unknown as DB;
}

/** Places a real outbound call and records it in `call_sessions`. */
export async function initiateCall(
  supabase: DB,
  input: { candidateId: string; jobId?: string | null | undefined },
) {
  const { data: settings } = await supabase
    .from("telephony_settings")
    .select("agent_id, agent_phone_number_id, enabled")
    .eq("singleton", true)
    .maybeSingle();

  if (!settings?.enabled || !settings.agent_id || !settings.agent_phone_number_id) {
    throw new HttpError(
      409,
      "Live calling is not configured yet. Add your voice agent in Settings.",
    );
  }

  const { data: candidate } = await supabase
    .from("candidates")
    .select("candidate_id, full_name, phone_number, job_id")
    .eq("candidate_id", input.candidateId)
    .maybeSingle();
  if (!candidate) throw new HttpError(404, "Candidate not found");
  if (!candidate.phone_number) throw new HttpError(422, "This candidate has no phone number");

  let toNumber: string;
  try {
    toNumber = toDialableNumber(candidate.phone_number);
  } catch (e) {
    throw new HttpError(422, e instanceof Error ? e.message : "Invalid phone number");
  }

  const jobId = input.jobId ?? candidate.job_id ?? null;
  const job = jobId
    ? (
        await supabase
          .from("jobs")
          .select("title, company_name, location, salary_range, jd_text")
          .eq("job_id", jobId)
          .maybeSingle()
      ).data
    : null;

  const { data: call, error: callErr } = await supabase
    .from("call_sessions")
    .insert({
      candidate_id: candidate.candidate_id,
      job_id: jobId,
      call_status: "dialing",
      provider: "elevenlabs_twilio",
      call_start_time: new Date().toISOString(),
    })
    .select("call_id")
    .single();
  if (callErr || !call) throw new HttpError(500, callErr?.message ?? "Could not create call");

  try {
    const result = await placeOutboundCall({
      agentId: settings.agent_id,
      agentPhoneNumberId: settings.agent_phone_number_id,
      toNumber,
      dynamicVariables: {
        candidate_name: candidate.full_name,
        job_title: job?.title ?? "an open role",
        company_name: job?.company_name ?? "our client",
        job_location: job?.location ?? "",
        salary_range: job?.salary_range ?? "",
        job_description: (job?.jd_text ?? "").slice(0, 1500),
        call_id: call.call_id,
      },
    });

    await supabase
      .from("call_sessions")
      .update({ external_call_id: result.conversation_id, call_status: "in_progress" })
      .eq("call_id", call.call_id);

    return {
      call_id: call.call_id as string,
      conversation_id: result.conversation_id,
      call_sid: result.call_sid,
      status: "in_progress",
      to: toNumber,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Call failed";
    await supabase
      .from("call_sessions")
      .update({ call_status: "failed", error_message: message.slice(0, 500) })
      .eq("call_id", call.call_id);
    throw new HttpError(502, message);
  }
}

/** Current status of a call, enriched with the live provider status when available. */
export async function getCallStatus(supabase: DB, callId: string) {
  const { data: call } = await supabase
    .from("call_sessions")
    .select(
      "call_id, candidate_id, job_id, call_status, provider, external_call_id, call_start_time, call_end_time, ai_confidence, error_message, transcript_text",
    )
    .eq("call_id", callId)
    .maybeSingle();
  if (!call) throw new HttpError(404, "Call not found");

  let providerStatus: string | null = null;
  if (call.provider === "elevenlabs_twilio" && call.external_call_id) {
    providerStatus = await fetchConversationStatus(call.external_call_id);
  }

  const duration =
    call.call_start_time && call.call_end_time
      ? Math.max(
          0,
          Math.round(
            (new Date(call.call_end_time).getTime() - new Date(call.call_start_time).getTime()) /
              1000,
          ),
        )
      : null;

  return {
    call_id: call.call_id,
    candidate_id: call.candidate_id,
    job_id: call.job_id,
    status: call.call_status,
    provider: call.provider,
    provider_status: providerStatus,
    conversation_id: call.external_call_id,
    started_at: call.call_start_time,
    ended_at: call.call_end_time,
    duration_seconds: duration,
    ai_confidence: call.ai_confidence,
    has_transcript: Boolean(call.transcript_text),
    error: call.error_message,
  };
}

async function fetchConversationStatus(conversationId: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/v1/convai/conversations/${conversationId}`, {
      headers: { "xi-api-key": requireElevenLabsKey() },
    });
    if (!res.ok) {
      logger.warn(`Conversation status lookup failed [${res.status}]`);
      return null;
    }
    const json = (await res.json()) as { status?: string };
    return json.status ?? null;
  } catch (e) {
    logger.warn("Conversation status lookup error", e instanceof Error ? e.message : String(e));
    return null;
  }
}

/** Streams the call recording audio back to the caller. */
export async function getCallRecording(supabase: DB, callId: string): Promise<Response> {
  const { data: call } = await supabase
    .from("call_sessions")
    .select("call_id, provider, external_call_id, recording_url")
    .eq("call_id", callId)
    .maybeSingle();
  if (!call) throw new HttpError(404, "Call not found");

  if (call.recording_url && !call.recording_url.includes("recordings.example.com")) {
    return Response.json({ call_id: call.call_id, recording_url: call.recording_url });
  }
  if (!call.external_call_id) {
    throw new HttpError(404, "No recording is available for this call");
  }

  const res = await fetch(`${API_BASE}/v1/convai/conversations/${call.external_call_id}/audio`, {
    headers: { "xi-api-key": requireElevenLabsKey() },
  });
  if (!res.ok) {
    const body = await res.text();
    logger.error(`Recording fetch failed [${res.status}]`, body);
    throw new HttpError(res.status === 404 ? 404 : 502, `Recording unavailable [${res.status}]`);
  }

  return new Response(res.body, {
    status: 200,
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "audio/mpeg",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="call-${call.call_id}.mp3"`,
    },
  });
}

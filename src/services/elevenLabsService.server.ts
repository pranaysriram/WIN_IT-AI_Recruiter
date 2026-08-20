import type { DB } from "@/db/connection";
import { QUESTION_CODES } from "@/utils/validation";
import { logger } from "@/utils/logger";

const API_BASE = "https://api.elevenlabs.io";

export { QUESTION_CODES };

export function requireElevenLabsKey(): string {
  const key = process.env["ELEVENLABS_API_KEY"];
  if (!key) throw new Error("ElevenLabs is not connected to this project");
  return key;
}

export type OutboundCallResult = {
  conversation_id: string | null;
  call_sid: string | null;
};

/** Places a real outbound phone call through ElevenLabs' Twilio integration. */
export async function placeOutboundCall(input: {
  agentId: string;
  agentPhoneNumberId: string;
  toNumber: string;
  dynamicVariables: Record<string, string>;
}): Promise<OutboundCallResult> {
  const res = await fetch(`${API_BASE}/v1/convai/twilio/outbound-call`, {
    method: "POST",
    headers: {
      "xi-api-key": requireElevenLabsKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      agent_id: input.agentId,
      agent_phone_number_id: input.agentPhoneNumberId,
      to_number: input.toNumber,
      conversation_initiation_client_data: {
        dynamic_variables: input.dynamicVariables,
      },
    }),
  });

  const body = await res.text();
  if (!res.ok) {
    logger.error(`ElevenLabs outbound call failed [${res.status}]`, body);
    throw new Error(`Outbound call failed [${res.status}]: ${body}`);
  }

  const json = JSON.parse(body) as {
    success?: boolean;
    message?: string;
    conversation_id?: string;
    callSid?: string;
  };
  if (json.success === false) {
    throw new Error(json.message ?? "ElevenLabs rejected the call request");
  }
  return { conversation_id: json.conversation_id ?? null, call_sid: json.callSid ?? null };
}

/** Verifies the `elevenlabs-signature` HMAC header (format: `t=<unix>,v0=<hex>`). */
export async function verifyWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  ) as { t?: string; v0?: string };
  if (!parts.t || !parts.v0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(parts.t));
  if (!Number.isFinite(age) || age > 30 * 60) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBytes = await crypto.subtle.sign("HMAC", key, enc.encode(`${parts.t}.${rawBody}`));
  const expected = [...new Uint8Array(sigBytes)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const given = parts.v0.replace(/^v0=/, "");
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

type TranscriptTurn = { role?: string; message?: string | null };

export type PostCallPayload = {
  type?: string;
  data?: {
    conversation_id?: string;
    status?: string;
    transcript?: TranscriptTurn[];
    metadata?: { call_duration_secs?: number; start_time_unix_secs?: number };
    analysis?: {
      transcript_summary?: string;
      call_successful?: string;
      data_collection_results?: Record<string, { value?: unknown; rationale?: string }>;
    };
  };
};

export function formatTranscript(turns: TranscriptTurn[] | undefined): string {
  if (!turns?.length) return "";
  return turns
    .filter((t) => (t.message ?? "").trim().length > 0)
    .map((t) => `${t.role === "agent" ? "AI" : "Candidate"}: ${(t.message ?? "").trim()}`)
    .join("\n");
}

/** Writes a completed live call back into the call log. */
export async function ingestPostCall(supabase: DB, payload: PostCallPayload) {
  const data = payload.data;
  const conversationId = data?.conversation_id;
  if (!conversationId) return { ok: false, reason: "missing conversation_id" };

  const { data: call } = await supabase
    .from("call_sessions")
    .select("call_id, candidate_id, call_start_time")
    .eq("external_call_id", conversationId)
    .maybeSingle();
  if (!call) return { ok: false, reason: "unknown conversation" };

  const transcript = formatTranscript(data?.transcript);
  const durationSecs = data?.metadata?.call_duration_secs ?? 0;
  const startUnix = data?.metadata?.start_time_unix_secs;
  const startedAt = startUnix
    ? new Date(startUnix * 1000)
    : new Date(call.call_start_time ?? Date.now());

  const successful = data?.analysis?.call_successful;
  const status =
    transcript.length === 0 || data?.status === "failed"
      ? "no_answer"
      : successful === "failure"
        ? "declined"
        : "completed";

  await supabase
    .from("call_sessions")
    .update({
      call_status: status,
      transcript_text: transcript || null,
      call_start_time: startedAt.toISOString(),
      call_end_time: new Date(startedAt.getTime() + durationSecs * 1000).toISOString(),
      ai_confidence: successful === "success" ? 92 : successful === "failure" ? 55 : 75,
    })
    .eq("call_id", call.call_id);

  const collected = data?.analysis?.data_collection_results ?? {};
  const rows = Object.entries(collected)
    .filter(
      ([code, v]) =>
        QUESTION_CODES.includes(code as (typeof QUESTION_CODES)[number]) && v?.value != null,
    )
    .map(([code, v]) => ({
      call_id: call.call_id,
      question_code: code,
      response_text: v.rationale ?? String(v.value),
      response_value: String(v.value).slice(0, 100),
    }));

  if (rows.length) {
    await supabase.from("candidate_responses").delete().eq("call_id", call.call_id);
    await supabase.from("candidate_responses").insert(rows);
  }

  await supabase
    .from("candidates")
    .update({
      status: status === "completed" ? "screened" : status === "declined" ? "declined" : "no_answer",
    })
    .eq("candidate_id", call.candidate_id);

  return { ok: true, call_id: call.call_id };
}

/* ---------------- Text-to-speech (AI text -> ElevenLabs -> speech) --------------- */

export const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL"; // Sarah

export type VoiceOption = { voice_id: string; name: string; category: string | null };

/** Lists the voices available on the connected ElevenLabs account. */
export async function listVoices(): Promise<VoiceOption[]> {
  const res = await fetch(`${API_BASE}/v1/voices`, {
    headers: { "xi-api-key": requireElevenLabsKey() },
  });
  const body = await res.text();
  if (!res.ok) {
    logger.error(`ElevenLabs voices failed [${res.status}]`, body);
    throw new Error(`Could not load voices [${res.status}]: ${body}`);
  }
  const json = JSON.parse(body) as {
    voices?: { voice_id: string; name: string; category?: string }[];
  };
  return (json.voices ?? []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category ?? null,
  }));
}

/** Converts text into speech and returns raw MP3 bytes. */
export async function synthesizeSpeech(input: {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  speed?: number;
}): Promise<ArrayBuffer> {
  const voiceId = input.voiceId || DEFAULT_VOICE_ID;
  const res = await fetch(
    `${API_BASE}/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: {
        "xi-api-key": requireElevenLabsKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input.text,
        model_id: input.modelId ?? "eleven_multilingual_v2",
        voice_settings: {
          stability: input.stability ?? 0.5,
          similarity_boost: input.similarityBoost ?? 0.75,
          style: 0.35,
          use_speaker_boost: true,
          speed: input.speed ?? 1.0,
        },
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    logger.error(`ElevenLabs TTS failed [${res.status}]`, err);
    if (/quota_exceeded/.test(err)) {
      throw new Error(
        "Your ElevenLabs account is out of character credits, so no speech could be generated. Top up the ElevenLabs plan and try again.",
      );
    }
    throw new Error(`Speech generation failed [${res.status}]: ${err}`);
  }
  return res.arrayBuffer();
}

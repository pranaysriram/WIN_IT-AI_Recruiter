import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/middleware/auth";
import {
  formatTranscript,
  transcribeAudioUrl,
  uploadAudio,
} from "@/services/assemblyAIService.server";
import { analyseTranscript } from "@/services/transcriptAnalysisService.server";
import type { DB } from "@/db/connection";

const uploadInput = z.object({
  candidateId: z.string().uuid(),
  callId: z.string().uuid().nullable().optional(),
  audioBase64: z.string().min(16),
  fileName: z.string().max(200).optional(),
  languageCode: z.string().max(10).optional(),
});

const recordingInput = z.object({ callId: z.string().uuid() });

type Persisted = {
  callId: string;
  transcript: string;
  summary: string;
  outcome: string;
  confidence: number;
  durationSec: number;
  language: string | null;
  responses: { question_code: string; response_text: string; response_value: string }[];
};

/** Stores the transcript on a call session (creating one when needed) + extracted answers. */
async function persistTranscript(
  supabase: DB,
  args: {
    candidateId: string;
    callId: string | null;
    transcript: string;
    recordingUrl: string | null;
    durationSec: number;
    insights: Awaited<ReturnType<typeof analyseTranscript>>;
  },
): Promise<string> {
  const { candidateId, transcript, recordingUrl, durationSec, insights } = args;
  const confidence = Math.round(insights.ai_confidence * 100) / 100;
  let callId = args.callId;

  if (callId) {
    const { error } = await supabase
      .from("call_sessions")
      .update({
        transcript_text: transcript,
        ai_confidence: confidence,
        call_status: insights.outcome,
        ...(recordingUrl ? { recording_url: recordingUrl } : {}),
      })
      .eq("call_id", callId);
    if (error) throw new Error(error.message);
    await supabase.from("candidate_responses").delete().eq("call_id", callId);
  } else {
    const { data: candidate } = await supabase
      .from("candidates")
      .select("job_id")
      .eq("candidate_id", candidateId)
      .maybeSingle();
    const start = new Date(Date.now() - durationSec * 1000);
    const { data, error } = await supabase
      .from("call_sessions")
      .insert({
        candidate_id: candidateId,
        job_id: candidate?.job_id ?? null,
        provider: "assemblyai",
        call_start_time: start.toISOString(),
        call_end_time: new Date().toISOString(),
        call_status: insights.outcome,
        transcript_text: transcript,
        ai_confidence: confidence,
        recording_url: recordingUrl,
      })
      .select("call_id")
      .single();
    if (error) throw new Error(error.message);
    callId = data.call_id;
  }

  if (insights.responses.length) {
    const { error } = await supabase.from("candidate_responses").insert(
      insights.responses.map((r) => ({
        call_id: callId as string,
        question_code: r.question_code,
        response_text: r.response_text,
        response_value: r.response_value.slice(0, 100),
      })),
    );
    if (error) throw new Error(error.message);
  }

  await supabase
    .from("candidates")
    .update({
      status:
        insights.outcome === "completed"
          ? "screened"
          : insights.outcome === "declined"
            ? "declined"
            : "no_answer",
    })
    .eq("candidate_id", candidateId);

  return callId as string;
}

async function loadContext(supabase: DB, candidateId: string) {
  const { data: candidate } = await supabase
    .from("candidates")
    .select("full_name, job_id")
    .eq("candidate_id", candidateId)
    .maybeSingle();
  const job = candidate?.job_id
    ? (await supabase.from("jobs").select("title").eq("job_id", candidate.job_id).maybeSingle()).data
    : null;
  return { name: candidate?.full_name ?? "Candidate", jobTitle: job?.title ?? null };
}

/** Candidate voice (upload) → AssemblyAI → transcript → database. */
export const transcribeCandidateAudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => uploadInput.parse(data))
  .handler(async ({ data, context }): Promise<Persisted> => {
    const bytes = Buffer.from(data.audioBase64, "base64");
    if (bytes.byteLength < 2048) throw new Error("That recording is too short — please try again");
    if (bytes.byteLength > 25 * 1024 * 1024) throw new Error("Audio must be under 25 MB");

    const audioUrl = await uploadAudio(new Uint8Array(bytes));
    const result = await transcribeAudioUrl(audioUrl, {
      speakerLabels: true,
      ...(data.languageCode ? { languageCode: data.languageCode } : {}),
    });
    const transcript = formatTranscript(result);
    if (!transcript.trim()) throw new Error("No speech was detected in that recording");

    const ctx = await loadContext(context.supabase, data.candidateId);
    const insights = await analyseTranscript({
      transcript,
      candidateName: ctx.name,
      jobTitle: ctx.jobTitle,
    });

    const callId = await persistTranscript(context.supabase, {
      candidateId: data.candidateId,
      callId: data.callId ?? null,
      transcript,
      recordingUrl: null,
      durationSec: result.audioDurationSec,
      insights,
    });

    return {
      callId,
      transcript,
      summary: insights.summary,
      outcome: insights.outcome,
      confidence: insights.ai_confidence,
      durationSec: result.audioDurationSec,
      language: result.language,
      responses: insights.responses,
    };
  });

/** Existing call recording → AssemblyAI → transcript → database. */
export const transcribeCallRecording = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => recordingInput.parse(data))
  .handler(async ({ data, context }): Promise<Persisted> => {
    const { data: call, error } = await context.supabase
      .from("call_sessions")
      .select("call_id, candidate_id, recording_url")
      .eq("call_id", data.callId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!call) throw new Error("Call not found");
    if (!call.recording_url) throw new Error("This call has no recording to transcribe");

    const result = await transcribeAudioUrl(call.recording_url, { speakerLabels: true });
    const transcript = formatTranscript(result);
    if (!transcript.trim()) throw new Error("No speech was detected in the recording");

    const ctx = await loadContext(context.supabase, call.candidate_id);
    const insights = await analyseTranscript({
      transcript,
      candidateName: ctx.name,
      jobTitle: ctx.jobTitle,
    });

    await persistTranscript(context.supabase, {
      candidateId: call.candidate_id,
      callId: call.call_id,
      transcript,
      recordingUrl: call.recording_url,
      durationSec: result.audioDurationSec,
      insights,
    });

    return {
      callId: call.call_id,
      transcript,
      summary: insights.summary,
      outcome: insights.outcome,
      confidence: insights.ai_confidence,
      durationSec: result.audioDurationSec,
      language: result.language,
      responses: insights.responses,
    };
  });

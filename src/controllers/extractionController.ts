import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/middleware/auth";
import {
  EXTRACTION_MODEL,
  extractStructuredData,
  type StructuredExtraction,
} from "@/services/extractionService.server";

const input = z.object({
  callId: z.string().uuid().nullable().optional(),
  candidateId: z.string().uuid().nullable().optional(),
  transcript: z.string().max(60000).optional(),
  persist: z.boolean().optional(),
});

export type ExtractionResult = {
  callId: string | null;
  candidateName: string;
  jobTitle: string | null;
  transcript: string;
  extraction: StructuredExtraction;
  model: string;
  extractedAt: string;
  persisted: boolean;
};

/** Transcript → LLM → structured JSON (optionally stored on the call record). */
export const extractResponses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }): Promise<ExtractionResult> => {
    const supabase = context.supabase;

    let transcript = (data.transcript ?? "").trim();
    let candidateId = data.candidateId ?? null;
    let jobId: string | null = null;

    if (data.callId) {
      const { data: call, error } = await supabase
        .from("call_sessions")
        .select("call_id, candidate_id, job_id, transcript_text")
        .eq("call_id", data.callId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!call) throw new Error("Call not found");
      candidateId = call.candidate_id;
      jobId = call.job_id;
      if (!transcript) transcript = (call.transcript_text ?? "").trim();
    }

    if (!transcript) throw new Error("No transcript available to extract from");

    let candidateName = "Candidate";
    if (candidateId) {
      const { data: candidate } = await supabase
        .from("candidates")
        .select("full_name, job_id")
        .eq("candidate_id", candidateId)
        .maybeSingle();
      candidateName = candidate?.full_name ?? candidateName;
      jobId = jobId ?? candidate?.job_id ?? null;
    }

    let jobTitle: string | null = null;
    let jobDescription: string | null = null;
    if (jobId) {
      const { data: job } = await supabase
        .from("jobs")
        .select("title, jd_text")
        .eq("job_id", jobId)
        .maybeSingle();
      jobTitle = job?.title ?? null;
      jobDescription = job?.jd_text ?? null;
    }

    const extraction = await extractStructuredData({
      transcript,
      candidateName,
      jobTitle,
      jobDescription,
    });

    const extractedAt = new Date().toISOString();
    let persisted = false;

    if (data.persist !== false && data.callId) {
      const { error } = await supabase
        .from("call_sessions")
        .update({
          extraction_json: JSON.parse(JSON.stringify(extraction)),
          extraction_model: EXTRACTION_MODEL,
          extracted_at: extractedAt,
          ai_confidence: Math.round(extraction.ai_confidence * 100) / 100,
          call_status: extraction.outcome,
        })
        .eq("call_id", data.callId);
      if (error) throw new Error(error.message);

      await supabase.from("candidate_responses").delete().eq("call_id", data.callId);
      if (extraction.responses.length) {
        const { error: respError } = await supabase.from("candidate_responses").insert(
          extraction.responses.map((r) => ({
            call_id: data.callId as string,
            question_code: r.question_code,
            response_text: r.response_text,
            response_value: r.response_value.slice(0, 100),
          })),
        );
        if (respError) throw new Error(respError.message);
      }

      if (candidateId) {
        await supabase
          .from("candidates")
          .update({
            status:
              extraction.outcome === "completed"
                ? "screened"
                : extraction.outcome === "declined"
                  ? "declined"
                  : "no_answer",
          })
          .eq("candidate_id", candidateId);
      }
      persisted = true;
    }

    return {
      callId: data.callId ?? null,
      candidateName,
      jobTitle,
      transcript,
      extraction,
      model: EXTRACTION_MODEL,
      extractedAt,
      persisted,
    };
  });

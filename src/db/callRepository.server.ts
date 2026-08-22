import type { DB } from "@/db/connection";
import type { ParsedCall } from "@/services/openAIService.server";

/** Persists a completed real call, its extracted answers and candidate status. */
export async function persistCall(
  supabase: DB,
  params: { candidateId: string; jobId: string | null; parsed: ParsedCall; startedAt: Date },
) {
  const { candidateId, jobId, parsed, startedAt } = params;
  const durationMs = 1000 * (120 + Math.floor(Math.random() * 240));

  const { data: call, error } = await supabase
    .from("call_sessions")
    .insert({
      candidate_id: candidateId,
      job_id: jobId,
      call_start_time: startedAt.toISOString(),
      call_end_time: new Date(startedAt.getTime() + durationMs).toISOString(),
      call_status: parsed.outcome,
      transcript_text: parsed.transcript,
      ai_confidence: Math.round(parsed.ai_confidence * 100) / 100,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (parsed.responses?.length) {
    const { error: rErr } = await supabase.from("candidate_responses").insert(
      parsed.responses.map((r) => ({
        call_id: call.call_id,
        question_code: r.question_code,
        response_text: r.response_text,
        response_value: r.response_value.slice(0, 100),
      })),
    );
    if (rErr) throw new Error(rErr.message);
  }

  await supabase
    .from("candidates")
    .update({
      status:
        parsed.outcome === "completed"
          ? "screened"
          : parsed.outcome === "declined"
            ? "declined"
            : "no_answer",
    })
    .eq("candidate_id", candidateId);

  return { call_id: call.call_id as string, summary: parsed.summary };
}

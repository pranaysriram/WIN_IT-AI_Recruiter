import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/middleware/auth";
import { generateScript } from "@/services/voiceScriptService.server";
import { listVoices, synthesizeSpeech } from "@/services/elevenLabsService.server";

const scriptInput = z.object({
  kind: z.enum(["intro", "screening", "interview_invite", "rejection", "custom"]),
  instruction: z.string().max(1000).optional(),
  candidateId: z.string().uuid().nullable().optional(),
});

const speechInput = z.object({
  text: z.string().min(1).max(4500),
  voiceId: z.string().min(1).max(64).optional(),
  speed: z.number().min(0.7).max(1.2).optional(),
  stability: z.number().min(0).max(1).optional(),
});

/** Step 1 — AI text. */
export const generateVoiceScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => scriptInput.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;
    let candidateName: string | null = null;
    let jobId: string | null = null;

    if (data.candidateId) {
      const { data: candidate } = await supabase
        .from("candidates")
        .select("full_name, job_id")
        .eq("candidate_id", data.candidateId)
        .maybeSingle();
      candidateName = candidate?.full_name ?? null;
      jobId = candidate?.job_id ?? null;
    }

    const job = jobId
      ? (
          await supabase
            .from("jobs")
            .select("title, company_name, location, salary_range, jd_text")
            .eq("job_id", jobId)
            .maybeSingle()
        ).data
      : null;

    const script = await generateScript({
      kind: data.kind,
      instruction: data.instruction ?? "",
      candidateName,
      job,
    });
    return { script };
  });

/** Step 2 — ElevenLabs speech. Returns base64 MP3 for browser playback. */
export const synthesizeVoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => speechInput.parse(data))
  .handler(async ({ data }) => {
    const audio = await synthesizeSpeech({
      text: data.text,
      ...(data.voiceId ? { voiceId: data.voiceId } : {}),
      ...(data.speed != null ? { speed: data.speed } : {}),
      ...(data.stability != null ? { stability: data.stability } : {}),
    });
    return {
      audioBase64: Buffer.from(audio).toString("base64"),
      mimeType: "audio/mpeg",
      characters: data.text.length,
    };
  });

export const getVoiceOptions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({ voices: await listVoices() }));

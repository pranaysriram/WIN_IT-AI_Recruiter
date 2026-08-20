const MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are Ava, an AI recruitment calling assistant.
Write short spoken scripts that a voice agent will read aloud on a phone call.
Rules: natural spoken English, no markdown, no stage directions, no speaker labels,
no emojis, 60-130 words, warm and professional, end with a clear question or next step.
Return only the script text.`;

export type ScriptKind = "intro" | "screening" | "interview_invite" | "rejection" | "custom";

const KIND_BRIEF: Record<ScriptKind, string> = {
  intro: "Opening of a first outreach call: greet the candidate, introduce yourself, ask consent to continue, and pitch the role in two sentences.",
  screening: "Screening segment: ask about current and expected salary, notice period, and location or work preference, one question at a time.",
  interview_invite: "Invite the candidate to an interview, propose two time options, and ask them to confirm.",
  rejection: "Politely tell the candidate they are not moving forward, thank them, and offer to keep them in mind for future roles.",
  custom: "Follow the recruiter's instruction exactly.",
};

/** Generates the spoken text that ElevenLabs will voice. */
export async function generateScript(input: {
  kind: ScriptKind;
  instruction?: string;
  candidateName?: string | null;
  job?: {
    title: string;
    company_name: string | null;
    location: string | null;
    salary_range: string | null;
    jd_text: string | null;
  } | null;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI service is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: JSON.stringify({
            brief: KIND_BRIEF[input.kind],
            recruiter_instruction: input.instruction ?? "",
            candidate_name: input.candidateName ?? "the candidate",
            job: input.job
              ? { ...input.job, jd_text: (input.job.jd_text ?? "").slice(0, 1200) }
              : null,
          }),
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 429) throw new Error("AI is rate limited right now — try again shortly.");
    if (res.status === 402) throw new Error("AI credits are exhausted. Add credits to continue.");
    throw new Error(`Script generation failed [${res.status}]: ${body}`);
  }

  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("The AI returned an empty script");
  return text;
}

import { QUESTION_CODES } from "@/utils/validation";

const MODEL = "google/gemini-3.5-flash";

export type StructuredExtraction = {
  summary: string;
  outcome: "completed" | "no_answer" | "declined";
  ai_confidence: number;
  sentiment: "positive" | "neutral" | "negative";
  interest_level: "high" | "medium" | "low" | "unknown";
  fit_score: number;
  profile: {
    current_company: string | null;
    current_role: string | null;
    total_experience_years: number | null;
    current_salary: string | null;
    expected_salary: string | null;
    notice_period: string | null;
    current_location: string | null;
    preferred_work_mode: string | null;
    skills: string[];
    availability: string | null;
  };
  responses: { question_code: string; response_text: string; response_value: string }[];
  red_flags: string[];
  follow_up_actions: string[];
  recommendation: "advance" | "hold" | "reject";
  recommendation_reason: string;
};

export const EXTRACTION_MODEL = MODEL;

const SYSTEM_PROMPT = `You extract structured recruitment data from a screening call transcript.
Rules:
- Only use information explicitly present in the transcript. Never invent facts.
- Use null (or an empty array) whenever a field was not discussed.
- Keep salary, notice period and location values verbatim-ish and short.
- fit_score is 0-100 based on how well the candidate matches the job context provided.
- ai_confidence is 0-100 and reflects how reliably the transcript supports the extraction.`;

const parameters = {
  type: "object",
  properties: {
    summary: { type: "string", description: "3-4 sentence recruiter-facing summary" },
    outcome: { type: "string", enum: ["completed", "no_answer", "declined"] },
    ai_confidence: { type: "number", description: "0-100" },
    sentiment: { type: "string", enum: ["positive", "neutral", "negative"] },
    interest_level: { type: "string", enum: ["high", "medium", "low", "unknown"] },
    fit_score: { type: "number", description: "0-100" },
    profile: {
      type: "object",
      properties: {
        current_company: { type: ["string", "null"] },
        current_role: { type: ["string", "null"] },
        total_experience_years: { type: ["number", "null"] },
        current_salary: { type: ["string", "null"] },
        expected_salary: { type: ["string", "null"] },
        notice_period: { type: ["string", "null"] },
        current_location: { type: ["string", "null"] },
        preferred_work_mode: { type: ["string", "null"] },
        skills: { type: "array", items: { type: "string" } },
        availability: { type: ["string", "null"], description: "Interview availability mentioned" },
      },
      required: [
        "current_company",
        "current_role",
        "total_experience_years",
        "current_salary",
        "expected_salary",
        "notice_period",
        "current_location",
        "preferred_work_mode",
        "skills",
        "availability",
      ],
      additionalProperties: false,
    },
    responses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          question_code: { type: "string", enum: [...QUESTION_CODES] },
          response_text: { type: "string" },
          response_value: { type: "string" },
        },
        required: ["question_code", "response_text", "response_value"],
        additionalProperties: false,
      },
    },
    red_flags: { type: "array", items: { type: "string" } },
    follow_up_actions: { type: "array", items: { type: "string" } },
    recommendation: { type: "string", enum: ["advance", "hold", "reject"] },
    recommendation_reason: { type: "string" },
  },
  required: [
    "summary",
    "outcome",
    "ai_confidence",
    "sentiment",
    "interest_level",
    "fit_score",
    "profile",
    "responses",
    "red_flags",
    "follow_up_actions",
    "recommendation",
    "recommendation_reason",
  ],
  additionalProperties: false,
} as const;

/** Transcript → LLM → structured JSON. */
export async function extractStructuredData(input: {
  transcript: string;
  candidateName: string;
  jobTitle: string | null;
  jobDescription?: string | null;
}): Promise<StructuredExtraction> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI service is not configured");
  if (!input.transcript.trim()) throw new Error("Transcript is empty");

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
            candidate: input.candidateName,
            job_title: input.jobTitle,
            job_description: (input.jobDescription ?? "").slice(0, 4000),
            transcript: input.transcript.slice(0, 24000),
          }),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_extraction",
            description: "Structured recruitment data extracted from a call transcript",
            parameters,
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_extraction" } },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached, try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace");
  if (!res.ok) throw new Error(`Extraction failed (${res.status})`);

  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured result");
  return JSON.parse(args) as StructuredExtraction;
}

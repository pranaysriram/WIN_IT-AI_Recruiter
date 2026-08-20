import { QUESTION_CODES } from "@/utils/validation";

export type ParsedCall = {
  transcript: string;
  ai_confidence: number;
  summary: string;
  outcome: "completed" | "no_answer" | "declined";
  responses: { question_code: string; response_text: string; response_value: string }[];
  suggested_interview?: { date: string; time: string } | null;
};

const MODEL = "google/gemini-3.5-flash";

const SYSTEM_PROMPT = `You are the conversation engine of an AI recruitment calling assistant named Ava.
You simulate a realistic outbound recruiting phone call and then extract structured data from it.
The call must cover: consent/intro, a short job pitch from the JD, current salary, expected salary,
notice period, key skills confirmation, location and work preference, one candidate FAQ,
and an interview scheduling offer. Keep the transcript natural, 15-25 turns, prefixed "AI:" and "Candidate:".
Return ONLY JSON matching the requested schema.`;

export async function generateCall(input: {
  candidate: { full_name: string; phone_number: string | null };
  job: {
    title: string;
    company_name: string | null;
    location: string | null;
    salary_range: string | null;
    jd_text: string | null;
  } | null;
  instruction?: string;
}): Promise<ParsedCall> {
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
            candidate: input.candidate,
            job: input.job,
            recruiter_notes: input.instruction ?? "",
            today: new Date().toISOString().slice(0, 10),
          }),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_call",
            description: "Record the simulated call transcript and extracted answers",
            parameters: {
              type: "object",
              properties: {
                transcript: { type: "string" },
                ai_confidence: { type: "number", description: "0-100 confidence in the extraction" },
                summary: { type: "string" },
                outcome: { type: "string", enum: ["completed", "no_answer", "declined"] },
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
                suggested_interview: {
                  type: "object",
                  properties: { date: { type: "string" }, time: { type: "string" } },
                  required: ["date", "time"],
                  additionalProperties: false,
                },
              },
              required: ["transcript", "ai_confidence", "summary", "outcome", "responses"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_call" } },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached, try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace");
  if (!res.ok) throw new Error(`AI call failed (${res.status})`);

  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured result");
  return JSON.parse(args) as ParsedCall;
}

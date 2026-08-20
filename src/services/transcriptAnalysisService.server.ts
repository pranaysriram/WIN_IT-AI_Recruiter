import { QUESTION_CODES } from "@/utils/validation";

const MODEL = "google/gemini-3.5-flash";

export type TranscriptInsights = {
  summary: string;
  outcome: "completed" | "no_answer" | "declined";
  ai_confidence: number;
  responses: { question_code: string; response_text: string; response_value: string }[];
};

/** Turns a raw AssemblyAI transcript into structured screening answers. */
export async function analyseTranscript(input: {
  transcript: string;
  candidateName: string;
  jobTitle: string | null;
}): Promise<TranscriptInsights> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI service is not configured");

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            "You analyse recruitment screening call transcripts. Extract only answers actually present in the transcript. Never invent values.",
        },
        {
          role: "user",
          content: JSON.stringify({
            candidate: input.candidateName,
            job_title: input.jobTitle,
            transcript: input.transcript.slice(0, 20000),
          }),
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "record_insights",
            description: "Structured extraction from a screening call transcript",
            parameters: {
              type: "object",
              properties: {
                summary: { type: "string" },
                outcome: { type: "string", enum: ["completed", "no_answer", "declined"] },
                ai_confidence: { type: "number", description: "0-100" },
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
              },
              required: ["summary", "outcome", "ai_confidence", "responses"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "record_insights" } },
    }),
  });

  if (res.status === 429) throw new Error("AI rate limit reached, try again shortly");
  if (res.status === 402) throw new Error("AI credits exhausted for this workspace");
  if (!res.ok) throw new Error(`Transcript analysis failed (${res.status})`);

  const json = (await res.json()) as {
    choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
  };
  const args = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("AI returned no structured result");
  return JSON.parse(args) as TranscriptInsights;
}

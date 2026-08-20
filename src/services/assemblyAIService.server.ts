import { logger } from "@/utils/logger";

const API_BASE = "https://api.assemblyai.com/v2";
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100;

export type TranscriptUtterance = {
  speaker: string;
  text: string;
  start: number;
  end: number;
};

export type TranscriptionResult = {
  id: string;
  text: string;
  confidence: number;
  audioDurationSec: number;
  language: string | null;
  utterances: TranscriptUtterance[];
};

function requireKey(): string {
  const key = process.env["ASSEMBLYAI_API_KEY"];
  if (!key) throw new Error("AssemblyAI is not connected to this project");
  return key;
}

async function aai<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { authorization: requireKey(), ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) {
    logger.error(`AssemblyAI ${path} failed [${res.status}]`, body);
    if (res.status === 401) throw new Error("AssemblyAI rejected the API key");
    if (res.status === 402 || res.status === 429)
      throw new Error("AssemblyAI quota or rate limit reached — try again shortly");
    throw new Error(`AssemblyAI request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  return JSON.parse(body) as T;
}

/** Uploads raw candidate audio bytes and returns the temporary AssemblyAI URL. */
export async function uploadAudio(bytes: Uint8Array): Promise<string> {
  if (!bytes.byteLength) throw new Error("The audio file is empty");
  const json = await aai<{ upload_url: string }>("/upload", {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: bytes as unknown as BodyInit,
  });
  return json.upload_url;
}

/** Candidate voice → AssemblyAI → transcript (speaker-labelled). */
export async function transcribeAudioUrl(
  audioUrl: string,
  options: { speakerLabels?: boolean; languageCode?: string } = {},
): Promise<TranscriptionResult> {
  const created = await aai<{ id: string }>("/transcript", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      audio_url: audioUrl,
      speaker_labels: options.speakerLabels ?? true,
      punctuate: true,
      format_text: true,
      ...(options.languageCode
        ? { language_code: options.languageCode }
        : { language_detection: true }),
    }),
  });

  for (let i = 0; i < MAX_POLLS; i++) {
    const t = await aai<{
      id: string;
      status: string;
      text: string | null;
      confidence: number | null;
      audio_duration: number | null;
      language_code: string | null;
      error: string | null;
      utterances: { speaker: string; text: string; start: number; end: number }[] | null;
    }>(`/transcript/${created.id}`, { method: "GET" });

    if (t.status === "error") throw new Error(t.error ?? "AssemblyAI could not transcribe the audio");
    if (t.status === "completed") {
      return {
        id: t.id,
        text: t.text ?? "",
        confidence: t.confidence ?? 0,
        audioDurationSec: t.audio_duration ?? 0,
        language: t.language_code ?? null,
        utterances: (t.utterances ?? []).map((u) => ({
          speaker: u.speaker,
          text: u.text,
          start: u.start,
          end: u.end,
        })),
      };
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error("Transcription timed out — the recording is taking too long");
}

/** Renders utterances as a "Speaker A: ..." style transcript for storage. */
export function formatTranscript(result: TranscriptionResult): string {
  if (!result.utterances.length) return result.text;
  return result.utterances.map((u) => `Speaker ${u.speaker}: ${u.text}`).join("\n");
}

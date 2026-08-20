import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { FileAudio, Loader2, Mic, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { candidatesQuery } from "@/services/api";
import { transcribeCandidateAudio } from "@/controllers/transcriptionController";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/transcripts")({
  component: TranscriptionPage,
  head: () => ({
    meta: [
      { title: "Speech to Text | Ava Recruit" },
      {
        name: "description",
        content:
          "Turn candidate voice recordings into speaker-labelled transcripts with AssemblyAI and store the extracted screening answers automatically.",
      },
      { property: "og:title", content: "Speech to Text | Ava Recruit" },
      {
        property: "og:description",
        content: "Candidate voice to AssemblyAI transcript to your recruitment database.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < buf.length; i += 0x8000) {
    binary += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function TranscriptionPage() {
  const [candidateId, setCandidateId] = useState("none");
  const [fileName, setFileName] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const candidates = useQuery(candidatesQuery);
  const transcribe = useServerFn(transcribeCandidateAudio);

  const run = useMutation({
    mutationFn: async () => {
      if (candidateId === "none") throw new Error("Pick a candidate first");
      if (!blob) throw new Error("Add a recording or audio file first");
      return transcribe({
        data: {
          candidateId,
          audioBase64: await toBase64(blob),
          ...(fileName ? { fileName } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Transcript saved to the call log");
      void queryClient.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const out = new Blob(chunksRef.current, { type: recorder.mimeType });
        setBlob(out);
        setFileName(`recording.${recorder.mimeType.includes("mp4") ? "mp4" : "webm"}`);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to record");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const result = run.data;

  return (
    <AppShell
      title="Speech to text"
      subtitle="Candidate voice → AssemblyAI → transcript → database: upload or record an answer and the extracted screening answers land on the candidate automatically."
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">


        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-2">
              <Label>Candidate</Label>
              <Select value={candidateId} onValueChange={setCandidateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a candidate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a candidate…</SelectItem>
                  {(candidates.data ?? []).map((c) => (
                    <SelectItem key={c.candidate_id} value={c.candidate_id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label>Audio source</Label>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => inputRef.current?.click()}>
                  <Upload className="size-4" /> Upload file
                </Button>
                {recording ? (
                  <Button variant="destructive" onClick={stopRecording}>
                    <Square className="size-4" /> Stop
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => void startRecording()}>
                    <Mic className="size-4" /> Record
                  </Button>
                )}
              </div>
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBlob(f);
                  setFileName(f.name);
                }}
              />
              {fileName ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <FileAudio className="size-3.5" /> {fileName}
                  {blob ? ` · ${(blob.size / 1024).toFixed(0)} KB` : ""}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  MP3, WAV, M4A or WebM up to 25 MB.
                </p>
              )}
            </div>

            <Button
              onClick={() => run.mutate()}
              disabled={run.isPending || !blob || candidateId === "none"}
            >
              {run.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Transcribing…
                </>
              ) : (
                "Transcribe & save"
              )}
            </Button>
          </div>

          <div className="flex min-h-64 flex-col gap-3 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-sm font-semibold">Transcript</h2>
              {result ? (
                <div className="flex gap-2">
                  <Badge variant="secondary">{result.outcome}</Badge>
                  <Badge variant="outline">{Math.round(result.confidence)}% confidence</Badge>
                  <Badge variant="outline">{Math.round(result.durationSec)}s</Badge>
                </div>
              ) : null}
            </div>
            {result ? (
              <>
                <p className="text-sm text-muted-foreground">{result.summary}</p>
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-xs">
                  {result.transcript}
                </pre>
                {result.responses.length ? (
                  <div className="flex flex-col gap-1">
                    <p className="text-xs font-medium">Extracted answers</p>
                    {result.responses.map((r) => (
                      <div
                        key={r.question_code}
                        className="flex items-center justify-between rounded-md border border-border px-3 py-1.5 text-xs"
                      >
                        <span className="text-muted-foreground">{r.question_code}</span>
                        <span className="font-medium">{r.response_value}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Nothing transcribed yet. Pick a candidate, add audio, then run it.
              </p>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

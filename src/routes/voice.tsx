import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useRef, useState } from "react";
import { AudioLines, Download, Loader2, Sparkles, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { candidatesQuery } from "@/services/api";
import {
  generateVoiceScript,
  getVoiceOptions,
  synthesizeVoice,
} from "@/controllers/voiceController";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/voice")({
  component: VoiceStudioPage,
  head: () => ({
    meta: [
      { title: "AI Voice Studio | Ava Recruit" },
      {
        name: "description",
        content:
          "Draft recruitment call scripts with AI and turn them into natural speech with ElevenLabs voices before your agent dials a candidate.",
      },
      { property: "og:title", content: "AI Voice Studio | Ava Recruit" },
      {
        property: "og:description",
        content: "Generate AI call scripts and preview them as ElevenLabs speech.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const KINDS = [
  { value: "intro", label: "Outreach intro" },
  { value: "screening", label: "Screening questions" },
  { value: "interview_invite", label: "Interview invite" },
  { value: "rejection", label: "Polite rejection" },
  { value: "custom", label: "Custom instruction" },
] as const;

type Kind = (typeof KINDS)[number]["value"];

function VoiceStudioPage() {
  const [kind, setKind] = useState<Kind>("intro");
  const [candidateId, setCandidateId] = useState<string>("none");
  const [instruction, setInstruction] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState<string>("EXAVITQu4vr4xnSDxMaL");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const candidates = useQuery(candidatesQuery);
  const loadVoices = useServerFn(getVoiceOptions);
  const voices = useQuery({
    queryKey: ["elevenlabs-voices"],
    queryFn: () => loadVoices(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const draft = useServerFn(generateVoiceScript);
  const speak = useServerFn(synthesizeVoice);

  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl); }, [audioUrl]);

  const generate = useMutation({
    mutationFn: () =>
      draft({
        data: {
          kind,
          instruction: instruction.trim(),
          candidateId: candidateId === "none" ? null : candidateId,
        },
      }),
    onSuccess: (res) => {
      setScript(res.script);
      toast.success("Script drafted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const synthesize = useMutation({
    mutationFn: () => speak({ data: { text: script.trim(), voiceId } }),
    onSuccess: (res) => {
      const bytes = Uint8Array.from(atob(res.audioBase64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: res.mimeType }));
      setAudioUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      queueMicrotask(() => void audioRef.current?.play().catch(() => {}));
      toast.success(`Speech generated (${res.characters} characters)`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const voiceList = useMemo(() => voices.data?.voices ?? [], [voices.data]);

  return (
    <AppShell
      title="AI Voice Studio"
      subtitle="AI text → ElevenLabs → speech: draft what Ava should say, then hear it in the voice your agent uses on calls."
    >
      <div className="space-y-6">


        <div className="grid gap-5 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">1 · AI text</h2>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Script type</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Personalise for</Label>
                <Select value={candidateId} onValueChange={setCandidateId}>
                  <SelectTrigger><SelectValue placeholder="No candidate" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No candidate</SelectItem>
                    {(candidates.data ?? []).map((c) => (
                      <SelectItem key={c.candidate_id} value={c.candidate_id}>
                        {c.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="instruction">Recruiter notes</Label>
              <Textarea
                id="instruction"
                rows={3}
                placeholder="Mention the hybrid policy and that we can move fast on notice period."
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
              />
            </div>

            <Button
              className="gap-2"
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
            >
              {generate.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              Draft script
            </Button>
          </section>

          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2">
              <AudioLines className="size-4 text-primary" />
              <h2 className="font-display text-sm font-semibold">2 · ElevenLabs speech</h2>
            </div>

            <div className="space-y-1.5">
              <Label>Voice</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder={voices.isLoading ? "Loading voices…" : "Pick a voice"} />
                </SelectTrigger>
                <SelectContent>
                  {voiceList.length === 0 && (
                    <SelectItem value="EXAVITQu4vr4xnSDxMaL">Sarah (default)</SelectItem>
                  )}
                  {voiceList.map((v) => (
                    <SelectItem key={v.voice_id} value={v.voice_id}>
                      {v.name}
                      {v.category ? ` · ${v.category}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {voices.isError && (
                <p className="text-xs text-destructive">
                  Could not load your ElevenLabs voices — the default voice still works.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="script">Spoken text</Label>
                <Badge variant="secondary">{script.trim().length} chars</Badge>
              </div>
              <Textarea
                id="script"
                rows={9}
                placeholder="Draft a script on the left, or type what Ava should say."
                value={script}
                onChange={(e) => setScript(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="gap-2"
                onClick={() => synthesize.mutate()}
                disabled={synthesize.isPending || script.trim().length === 0}
              >
                {synthesize.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Volume2 className="size-4" />
                )}
                Generate speech
              </Button>
              {audioUrl && (
                <Button variant="outline" className="gap-2" asChild>
                  <a href={audioUrl} download="ava-script.mp3">
                    <Download className="size-4" /> Download MP3
                  </a>
                </Button>
              )}
            </div>

            {audioUrl && (
              <audio ref={audioRef} controls src={audioUrl} className="w-full" />
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

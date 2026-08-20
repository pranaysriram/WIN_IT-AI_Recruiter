import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Braces, Download, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { callsQuery, QUESTION_LABELS } from "@/services/api";
import { extractResponses, type ExtractionResult } from "@/controllers/extractionController";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/extraction")({
  component: ExtractionPage,
  head: () => ({
    meta: [
      { title: "Response Extraction | Ava Recruit" },
      {
        name: "description",
        content:
          "Turn screening call transcripts into structured JSON: salary, notice period, skills, sentiment, fit score and a hiring recommendation.",
      },
      { property: "og:title", content: "Response Extraction | Ava Recruit" },
      {
        property: "og:description",
        content: "Transcript to LLM to structured JSON for every recruitment call.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const toneFor = (value: string) =>
  value === "positive" || value === "advance" || value === "high"
    ? "bg-primary/15 text-primary"
    : value === "negative" || value === "reject" || value === "low"
      ? "bg-destructive/15 text-destructive"
      : "bg-muted text-muted-foreground";

function ExtractionPage() {
  const queryClient = useQueryClient();
  const { data: calls } = useQuery(callsQuery);
  const [callId, setCallId] = useState<string>("");
  const [transcript, setTranscript] = useState("");
  const [result, setResult] = useState<ExtractionResult | null>(null);

  const run = useServerFn(extractResponses);
  const mutation = useMutation({
    mutationFn: (persist: boolean) =>
      run({
        data: {
          callId: callId || null,
          transcript: transcript.trim() || undefined,
          persist,
        },
      }),
    onSuccess: (data) => {
      setResult(data);
      if (!transcript.trim()) setTranscript(data.transcript);
      if (data.persisted) {
        void queryClient.invalidateQueries({ queryKey: ["calls"] });
        void queryClient.invalidateQueries({ queryKey: ["candidates"] });
      }
      toast.success(data.persisted ? "Extraction saved to the call record" : "Extraction ready");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const transcribedCalls = (calls ?? []).filter((c) => (c.transcript_text ?? "").trim().length > 0);
  const extraction = result?.extraction;

  const download = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result.extraction, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `extraction-${result.callId ?? "transcript"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppShell
      title="Response Extraction"
      subtitle="Transcript to LLM to structured JSON. Pick a transcribed call or paste any transcript."
    >
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="space-y-4 rounded-xl border border-border bg-card p-5">
            <div className="space-y-2">
              <Label>Call transcript source</Label>
              <Select
                value={callId}
                onValueChange={(value) => {
                  setCallId(value);
                  const call = transcribedCalls.find((c) => c.call_id === value);
                  setTranscript(call?.transcript_text ?? "");
                  setResult(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a transcribed call (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {transcribedCalls.map((call) => (
                    <SelectItem key={call.call_id} value={call.call_id}>
                      {(call.candidates as { full_name?: string } | null)?.full_name ?? "Candidate"}{" "}
                      · {new Date(call.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                  {!transcribedCalls.length && (
                    <SelectItem value="none" disabled>
                      No transcribed calls yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="transcript">Transcript</Label>
              <Textarea
                id="transcript"
                rows={14}
                value={transcript}
                placeholder={'AI: Hi, is this Priya?\nCandidate: Yes, speaking...'}
                onChange={(e) => setTranscript(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => mutation.mutate(Boolean(callId))}
                disabled={mutation.isPending || (!transcript.trim() && !callId)}
              >
                {mutation.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Extract structured JSON
              </Button>
              {callId && (
                <Button
                  variant="outline"
                  onClick={() => mutation.mutate(false)}
                  disabled={mutation.isPending}
                >
                  Preview without saving
                </Button>
              )}
            </div>
          </section>

          <section className="space-y-4">
            {!extraction && (
              <div className="flex h-full min-h-64 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                <Braces className="size-6" />
                Structured output will appear here.
              </div>
            )}

            {extraction && (
              <>
                <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className={toneFor(extraction.recommendation)}>
                      {extraction.recommendation}
                    </Badge>
                    <Badge className={toneFor(extraction.sentiment)}>{extraction.sentiment}</Badge>
                    <Badge variant="outline">Interest: {extraction.interest_level}</Badge>
                    <Badge variant="outline">Fit {Math.round(extraction.fit_score)}%</Badge>
                    <Badge variant="outline">
                      Confidence {Math.round(extraction.ai_confidence)}%
                    </Badge>
                    {result?.persisted && <Badge variant="outline">Saved</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{extraction.summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {extraction.recommendation_reason}
                  </p>
                </div>

                <div className="grid gap-3 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
                  {Object.entries(extraction.profile).map(([key, value]) => (
                    <div key={key}>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        {key.replace(/_/g, " ")}
                      </p>
                      <p className="text-sm">
                        {Array.isArray(value)
                          ? value.join(", ") || "—"
                          : value === null || value === ""
                            ? "—"
                            : String(value)}
                      </p>
                    </div>
                  ))}
                </div>

                {!!extraction.responses.length && (
                  <div className="space-y-2 rounded-xl border border-border bg-card p-5">
                    <p className="text-sm font-medium">Screening answers</p>
                    {extraction.responses.map((r, i) => (
                      <div key={`${r.question_code}-${i}`} className="text-sm">
                        <span className="text-muted-foreground">
                          {QUESTION_LABELS[r.question_code] ?? r.question_code}:{" "}
                        </span>
                        {r.response_value || r.response_text}
                      </div>
                    ))}
                  </div>
                )}

                {(!!extraction.red_flags.length || !!extraction.follow_up_actions.length) && (
                  <div className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2">
                    <div>
                      <p className="text-sm font-medium">Red flags</p>
                      <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                        {extraction.red_flags.length ? (
                          extraction.red_flags.map((f, i) => <li key={i}>{f}</li>)
                        ) : (
                          <li>None flagged</li>
                        )}
                      </ul>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Follow-ups</p>
                      <ul className="mt-1 list-disc pl-4 text-sm text-muted-foreground">
                        {extraction.follow_up_actions.length ? (
                          extraction.follow_up_actions.map((f, i) => <li key={i}>{f}</li>)
                        ) : (
                          <li>None</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}

                <div className="space-y-2 rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Raw JSON</p>
                    <Button size="sm" variant="outline" onClick={download}>
                      <Download className="size-4" /> Download
                    </Button>
                  </div>
                  <pre className="max-h-80 overflow-auto rounded-lg bg-muted/50 p-3 text-xs">
                    {JSON.stringify(extraction, null, 2)}
                  </pre>
                  <p className="text-[11px] text-muted-foreground">
                    Model {result?.model} · {new Date(result?.extractedAt ?? "").toLocaleString()}
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, CalendarPlus, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { scheduleInterview } from "@/controllers/interviewController";
import { transcribeCallRecording } from "@/controllers/transcriptionController";

import { AppShell } from "@/components/AppShell";
import { TranscriptViewer } from "@/components/TranscriptViewer";
import { callDetailQuery, QUESTION_LABELS, recruitersQuery } from "@/services/api";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/calls/$callId")({
  component: CallDetail,
  head: () => ({
    meta: [
      { title: "Call Transcript & Answers | Ava Recruit" },
      {
        name: "description",
        content:
          "Review the AI call transcript, structured screening answers and schedule the interview for this candidate.",
      },
      { property: "og:title", content: "Call Transcript & Answers | Ava Recruit" },
      {
        property: "og:description",
        content: "Full transcript, extracted answers and one-click interview scheduling.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function CallDetail() {
  const { callId } = Route.useParams();
  const qc = useQueryClient();
  const { data } = useQuery(callDetailQuery(callId));
  const recruiters = useQuery(recruitersQuery);
  const [open, setOpen] = useState(false);
  const [slot, setSlot] = useState({ date: "", time: "10:00", interviewer: "", meetingLink: "" });

  useEffect(() => {
    const channel = supabase
      .channel(`call-${callId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "call_sessions", filter: `call_id=eq.${callId}` },
        () => qc.invalidateQueries({ queryKey: ["call", callId] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [callId, qc]);

  const call = data?.call;
  const responses = data?.responses ?? [];

  const scheduleFn = useServerFn(scheduleInterview);
  const transcribeFn = useServerFn(transcribeCallRecording);

  const retranscribe = useMutation({
    mutationFn: () => transcribeFn({ data: { callId } }),
    onSuccess: () => {
      toast.success("Transcript updated from the recording");
      void qc.invalidateQueries({ queryKey: ["call", callId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const schedule = useMutation({
    mutationFn: async () => {
      if (!call) throw new Error("Call not loaded");
      return scheduleFn({
        data: {
          candidateId: call.candidate_id,
          jobId: call.job_id,
          date: slot.date,
          time: slot.time,
          interviewerName: slot.interviewer || null,
          durationMinutes: 45,
          meetingLink: slot.meetingLink || null,
        },
      });
    },
    onSuccess: (result) => {
      toast.success("Interview booked — calendar invite ready", {
        action: {
          label: "Add to calendar",
          onClick: () => window.open(result.googleUrl, "_blank", "noopener"),
        },
      });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["interviews"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell
      title={call?.candidates?.full_name ?? "Call"}
      subtitle={
        call
          ? `${call.jobs?.title ?? "No role"} · ${call.call_status.replace("_", " ")} · confidence ${call.ai_confidence ?? "—"}%`
          : "Loading call…"
      }
      actions={
        <>
          <Button variant="ghost" asChild>
            <Link to="/calls">
              <ArrowLeft className="size-4" /> Back
            </Link>
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!call}>
                <CalendarPlus className="size-4" /> Schedule interview
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule interview</DialogTitle>
                <DialogDescription>
                  Creates the interview record and a linked calendar event ID.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={slot.date}
                    onChange={(e) => setSlot({ ...slot, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={slot.time}
                    onChange={(e) => setSlot({ ...slot, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="interviewer">Interviewer</Label>
                <Input
                  id="interviewer"
                  list="recruiter-list"
                  value={slot.interviewer}
                  onChange={(e) => setSlot({ ...slot, interviewer: e.target.value })}
                  placeholder="Who will run it?"
                />
                <datalist id="recruiter-list">
                  {(recruiters.data ?? []).map((r) => (
                    <option key={r.recruiter_id} value={r.full_name} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-2">
                <Label htmlFor="meeting-link">Meeting link (optional)</Label>
                <Input
                  id="meeting-link"
                  value={slot.meetingLink}
                  onChange={(e) => setSlot({ ...slot, meetingLink: e.target.value })}
                  placeholder="https://meet.google.com/…"
                />
              </div>
              <Button
                disabled={!slot.date || schedule.isPending}
                onClick={() => schedule.mutate()}
              >
                Confirm booking
              </Button>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="panel p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Transcript</h2>
            <div className="flex items-center gap-3">
              {call?.recording_url ? (
                <>
                  <a
                    href={call.recording_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <PlayCircle className="size-4" /> Recording
                  </a>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={retranscribe.isPending}
                    onClick={() => retranscribe.mutate()}
                  >
                    {retranscribe.isPending ? "Transcribing…" : "Transcribe with AssemblyAI"}
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-4">
            <TranscriptViewer transcript={call?.transcript_text ?? null} />
          </div>
        </section>

        <div className="space-y-6">
          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Extracted answers</h2>
            <dl className="mt-4 space-y-3">
              {responses.map((r) => (
                <div key={r.response_id} className="rounded-lg border border-border p-3">
                  <dt className="text-eyebrow">
                    {QUESTION_LABELS[r.question_code] ?? r.question_code}
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{r.response_value}</dd>
                  <dd className="mt-1 text-xs text-muted-foreground">“{r.response_text}”</dd>
                </div>
              ))}
              {!responses.length ? (
                <p className="text-sm text-muted-foreground">No answers captured.</p>
              ) : null}
            </dl>
          </section>

          <section className="panel p-5">
            <h2 className="text-sm font-semibold">Candidate</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p>{call?.candidates?.email ?? "—"}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {call?.candidates?.phone_number ?? "—"}
              </p>
              <Badge variant="secondary">{call?.candidates?.source ?? "manual"}</Badge>
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarCheck2, X } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { InterviewScheduler } from "@/components/InterviewScheduler";
import { cancelInterview } from "@/controllers/interviewController";
import { interviewsQuery } from "@/services/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/interviews")({
  component: InterviewsPage,
  head: () => ({
    meta: [
      { title: "Interview Schedule | Ava Recruit" },
      {
        name: "description",
        content:
          "Every interview the AI assistant booked, with candidate, role, interviewer and linked calendar event.",
      },
      { property: "og:title", content: "Interview Schedule | Ava Recruit" },
      {
        property: "og:description",
        content: "Interviews booked automatically from AI screening calls.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function InterviewsPage() {
  const qc = useQueryClient();
  const interviews = useQuery(interviewsQuery);

  const cancelFn = useServerFn(cancelInterview);
  const cancel = useMutation({
    mutationFn: (id: string) => cancelFn({ data: { scheduleId: id } }),
    onSuccess: (r) => {
      toast.success("Interview cancelled");
      if (r?.calendarWarning) toast.warning(r.calendarWarning);
      qc.invalidateQueries({ queryKey: ["interviews"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = interviews.data ?? [];

  return (
    <AppShell title="Interviews" subtitle={`${rows.length} interviews on the calendar`}>
      <InterviewScheduler />

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((i) => (
          <article key={i.schedule_id} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{i.candidates?.full_name}</h2>
                <p className="text-xs text-muted-foreground">{i.candidates?.email}</p>
              </div>
              <Badge variant="secondary">{i.status}</Badge>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm">
              <CalendarCheck2 className="size-4 text-primary" />
              {new Date(`${i.interview_date}T${i.interview_time}`).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {i.jobs?.title} · {i.jobs?.company_name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Interviewer: {i.interviewer_name ?? "TBD"}
            </p>
            {i.meeting_link ? (
              <a
                href={i.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block text-xs text-primary hover:underline"
              >
                Join link
              </a>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {i.calendar_event_url ? (
                <Button variant="outline" size="sm" asChild>
                  <a href={i.calendar_event_url} target="_blank" rel="noreferrer">
                    <CalendarCheck2 className="size-4" /> Add to calendar
                  </a>
                </Button>
              ) : null}
              {i.status === "scheduled" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => cancel.mutate(i.schedule_id)}
                >
                  <X className="size-4" /> Cancel
                </Button>
              ) : null}
            </div>
          </article>
        ))}
        {!rows.length ? (
          <p className="text-sm text-muted-foreground">No interviews scheduled yet.</p>
        ) : null}
      </div>
    </AppShell>
  );
}

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarSearch, CalendarPlus, Loader2, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { candidatesQuery } from "@/services/api";
import {
  checkAvailability,
  getCalendarStatus,
  scheduleInterview,
} from "@/controllers/interviewController";

const DURATIONS = [30, 45, 60, 90];

export function InterviewScheduler() {
  const qc = useQueryClient();
  const timeZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    [],
  );

  const statusFn = useServerFn(getCalendarStatus);
  const availabilityFn = useServerFn(checkAvailability);
  const scheduleFn = useServerFn(scheduleInterview);

  const candidates = useQuery(candidatesQuery);
  const status = useQuery({ queryKey: ["calendar-status"], queryFn: () => statusFn({}) });

  const [candidateId, setCandidateId] = useState("");
  const [calendarId, setCalendarId] = useState("primary");
  const [date, setDate] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [duration, setDuration] = useState(45);
  const [interviewer, setInterviewer] = useState("");
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const availability = useMutation({
    mutationFn: () =>
      availabilityFn({
        data: { date, durationMinutes: duration, timeZone, calendarIds: [calendarId] },
      }),
    onSuccess: (r) => {
      setSelectedSlot(null);
      if (!r.slots.length) toast.warning("No free slots in the 09:00–18:00 window that day");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const book = useMutation({
    mutationFn: () =>
      scheduleFn({
        data: {
          candidateId,
          date,
          time: selectedSlot!,
          durationMinutes: duration,
          interviewerName: interviewer || null,
          timeZone,
          calendarId,
          addMeet: true,
        },
      }),
    onSuccess: (r) => {
      toast.success(
        r.provider === "google" ? "Interview created in Google Calendar" : "Interview scheduled",
      );
      if (r.calendarWarning) toast.warning(r.calendarWarning);
      qc.invalidateQueries({ queryKey: ["interviews"] });
      qc.invalidateQueries({ queryKey: ["candidates"] });
      availability.reset();
      setSelectedSlot(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const slots = availability.data?.slots ?? [];
  const busy = availability.data?.busy ?? [];
  const connected = status.data?.connected;

  return (
    <section className="panel p-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Schedule an interview</h2>
          <p className="text-xs text-muted-foreground">
            Checks the calendar for conflicts, then creates the event with a Meet link · {timeZone}
          </p>
        </div>
        <Badge variant={connected ? "default" : "secondary"}>
          {status.isPending
            ? "Checking calendar…"
            : connected
              ? "Google Calendar connected"
              : "Calendar offline — ICS fallback"}
        </Badge>
      </header>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <Label className="text-xs">Candidate</Label>
          <Select value={candidateId} onValueChange={setCandidateId}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pick an interested candidate" />
            </SelectTrigger>
            <SelectContent>
              {(candidates.data ?? []).map((c) => (
                <SelectItem key={c.candidate_id} value={c.candidate_id}>
                  {c.full_name} {c.email ? `· ${c.email}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Date</Label>
          <Input
            type="date"
            className="mt-1"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <Label className="text-xs">Duration</Label>
          <Select value={String(duration)} onValueChange={(v) => setDuration(Number(v))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-xs">Interviewer</Label>
          <Input
            className="mt-1"
            placeholder="Name (optional)"
            value={interviewer}
            onChange={(e) => setInterviewer(e.target.value)}
          />
        </div>

        {connected && (status.data?.calendars.length ?? 0) > 1 ? (
          <div className="xl:col-span-2">
            <Label className="text-xs">Calendar</Label>
            <Select value={calendarId} onValueChange={setCalendarId}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(status.data?.calendars ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.summary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => availability.mutate()}
          disabled={availability.isPending || !connected}
        >
          {availability.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarSearch className="size-4" />
          )}
          Check availability
        </Button>
        <Button
          onClick={() => book.mutate()}
          disabled={!candidateId || !selectedSlot || book.isPending}
        >
          {book.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarPlus className="size-4" />
          )}
          Create interview
        </Button>
        {busy.length ? (
          <span className="text-xs text-muted-foreground">
            {busy.length} busy block{busy.length === 1 ? "" : "s"} that day
          </span>
        ) : null}
      </div>

      {slots.length ? (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground">Free slots</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {slots.map((s) => (
              <Button
                key={s.startsAt}
                size="sm"
                variant={selectedSlot === s.time ? "default" : "secondary"}
                onClick={() => setSelectedSlot(s.time)}
              >
                {s.time}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {book.data?.meetingLink ? (
        <a
          href={book.data.meetingLink}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Video className="size-4" /> Meet link for the latest interview
        </a>
      ) : null}
    </section>
  );
}

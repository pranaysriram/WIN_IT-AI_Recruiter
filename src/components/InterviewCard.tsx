import { CalendarClock, Video, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function InterviewCard({
  date,
  time,
  interviewer,
  meetingLink,
  jobTitle,
  candidateName,
  actions,
}: {
  date: string;
  time: string | null;
  interviewer: string | null;
  meetingLink: string | null;
  jobTitle?: string | null;
  candidateName?: string | null;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-medium">{candidateName ?? "Interview"}</p>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="size-3" />
            {new Date(date).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })}
            {time ? ` · ${time.slice(0, 5)}` : ""}
          </p>
          {interviewer ? (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="size-3" /> {interviewer}
            </p>
          ) : null}
          {meetingLink ? (
            <a
              href={meetingLink}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <Video className="size-3" /> Join link
            </a>
          ) : null}
        </div>
        {jobTitle ? <Badge variant="secondary">{jobTitle}</Badge> : null}
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </Card>
  );
}

import { Link } from "@tanstack/react-router";
import { Phone, Mail, Briefcase } from "lucide-react";
import type { Candidate, Job } from "@/services/api";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CandidateCard({
  candidate,
  job,
  actions,
}: {
  candidate: Candidate;
  job?: Job | undefined;
  actions?: React.ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/candidates/$candidateId"
            params={{ candidateId: candidate.candidate_id }}
            className="font-medium hover:text-primary"
          >
            {candidate.full_name}
          </Link>
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            <p className="flex items-center gap-1.5">
              <Phone className="size-3" /> {candidate.phone_number ?? "—"}
            </p>
            {candidate.email ? (
              <p className="flex items-center gap-1.5">
                <Mail className="size-3" /> {candidate.email}
              </p>
            ) : null}
            {job ? (
              <p className="flex items-center gap-1.5">
                <Briefcase className="size-3" /> {job.title}
              </p>
            ) : null}
          </div>
        </div>
        <Badge variant="secondary" className="capitalize">
          {(candidate.status ?? "new").replace(/_/g, " ")}
        </Badge>
      </div>
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </Card>
  );
}

import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  completed: "bg-primary/15 text-primary",
  in_progress: "bg-amber-500/15 text-amber-400",
  dialing: "bg-amber-500/15 text-amber-400",
  failed: "bg-destructive/15 text-destructive",
  no_answer: "bg-muted text-muted-foreground",
  busy: "bg-muted text-muted-foreground",
};

export function CallStatus({ status, className }: { status: string | null; className?: string }) {
  const value = status ?? "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize",
        TONE[value] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {value.replace(/_/g, " ")}
    </span>
  );
}

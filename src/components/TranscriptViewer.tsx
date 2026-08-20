import { cn } from "@/lib/utils";

/** Renders a plain-text transcript as an alternating agent/candidate thread. */
export function TranscriptViewer({ transcript }: { transcript: string | null }) {
  const lines = (transcript ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No transcript yet. It appears here automatically when the call ends.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const match = /^([A-Za-z ]{2,20}):\s*(.*)$/.exec(line);
        const speaker = match?.[1] ?? "";
        const text = match?.[2] ?? line;
        const isAgent = /ava|agent|ai|recruiter/i.test(speaker);
        return (
          <div key={i} className={cn("flex", isAgent ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[80%] rounded-xl px-3 py-2 text-sm",
                isAgent ? "bg-secondary text-secondary-foreground" : "bg-primary/12 text-foreground",
              )}
            >
              {speaker ? (
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{speaker}</p>
              ) : null}
              <p className="whitespace-pre-wrap">{text}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

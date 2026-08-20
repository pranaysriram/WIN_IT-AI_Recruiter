import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  AudioLines,
  FileAudio,
  Braces,

  PhoneCall,
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarClock,
  UserRound,
  Settings,
  RefreshCw,
  ShieldCheck,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/candidates", label: "Candidates", icon: Users },
  { to: "/calls", label: "Calls", icon: PhoneCall },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/voice", label: "Voice Studio", icon: AudioLines },
  { to: "/transcripts", label: "Speech to Text", icon: FileAudio },
  { to: "/extraction", label: "Extraction", icon: Braces },

  { to: "/interviews", label: "Interviews", icon: CalendarClock },

  { to: "/ats", label: "ATS Sync", icon: RefreshCw },
  { to: "/recruiters", label: "Recruiters", icon: UserRound },
  { to: "/audit", label: "Audit Log", icon: ShieldCheck },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ email }: { email: string | null }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-sidebar px-4 py-6 md:flex">
      <div className="flex items-center gap-2 px-2">
        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <PhoneCall className="size-4" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-sm font-semibold">Ava Recruit</p>
          <p className="text-[11px] text-muted-foreground">AI calling console</p>
        </div>
      </div>
      <nav className="mt-8 flex flex-col gap-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                active && "bg-primary/12 text-primary",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto space-y-2 px-1">
        <p className="truncate text-xs text-muted-foreground">{email}</p>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/auth" });
          }}
        >
          <LogOut className="size-4" /> Sign out
        </Button>
      </div>
    </aside>
  );
}

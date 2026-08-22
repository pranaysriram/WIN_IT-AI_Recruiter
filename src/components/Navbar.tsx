import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { LogOut, Menu, PhoneCall } from "lucide-react";
import { NAV } from "@/components/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function Navbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  const navigate = useNavigate();

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-4 sm:items-end sm:gap-4 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 md:hidden" aria-label="Open navigation">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(84vw,20rem)] px-4">
              <SheetHeader className="border-b border-border pb-4 text-left">
                <SheetTitle className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <PhoneCall className="size-4" />
                  </span>
                  Ava Recruit
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-5 flex flex-col gap-1">
                {NAV.map(({ to, label, icon: Icon }) => (
                  <SheetClose asChild key={to}>
                    <Link to={to} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Icon className="size-4" />
                      {label}
                    </Link>
                  </SheetClose>
                ))}
              </nav>
              <Button
                variant="ghost"
                className="mt-6 w-full justify-start gap-2 text-muted-foreground"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </SheetContent>
          </Sheet>
          <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
          </div>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">{actions}</div>
      </header>
    </>
  );
}

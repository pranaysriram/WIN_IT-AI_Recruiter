import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { NAV } from "@/components/Sidebar";

export function Navbar({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
}) {
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-6">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>
      <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2 md:hidden">
        {NAV.map(({ to, label }) => (
          <Link
            key={to}
            to={to}
            className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}

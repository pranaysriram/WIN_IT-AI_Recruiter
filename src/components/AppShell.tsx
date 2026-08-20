import { useNavigate } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";

export function AppShell({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth" });
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-eyebrow animate-pulse">Connecting to call console…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar email={user.email ?? null} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar title={title} subtitle={subtitle} actions={actions} />
        <main className="flex-1 px-6 py-6">{children}</main>
      </div>
    </div>
  );
}

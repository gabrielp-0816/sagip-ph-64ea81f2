import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SagipLogo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  HandHeart,
  FileText,
  Bell,
  User,
  LogOut,
  Menu,
  ShieldCheck,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/donate", label: "Donate", icon: HandHeart },
  { to: "/request", label: "Request aid", icon: FileText },
  { to: "/requests", label: "My requests", icon: Inbox },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/profile", label: "My profile", icon: User },
] as const;

export function DashShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const meta = useQuery({
    queryKey: ["shell-meta"],
    queryFn: async () => {
      const [profile, notif] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name,is_verified,avatar_url").maybeSingle(),
        supabase.from("notifications").select("id").eq("is_read", false),
      ]);
      return { profile: profile.data, unread: notif.data?.length ?? 0 };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("shell-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () =>
        queryClient.invalidateQueries({ queryKey: ["shell-meta"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const onSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const name = meta.data?.profile ? `${meta.data.profile.first_name} ${meta.data.profile.last_name}` : "Citizen";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-paper">
      <div className="gov-stripe" />
      {/* Top bar */}
      <header className="sticky top-1 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 hover:bg-accent lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Toggle navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard">
              <SagipLogo />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Notifications">
              <Link to="/notifications">
                <Bell className="h-4 w-4" />
                {!!meta.data?.unread && (
                  <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                    {meta.data.unread}
                  </span>
                )}
              </Link>
            </Button>
            <Link
              to="/profile"
              className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-1 pr-3 text-sm hover:bg-accent sm:flex"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="font-medium">{name.split(" ")[0]}</span>
              {meta.data?.profile?.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-relief" />}
            </Link>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 lg:px-6">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card p-4 transition-transform lg:static lg:translate-x-0 lg:bg-transparent lg:p-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <nav className="space-y-0.5">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to || (n.to !== "/dashboard" && pathname.startsWith(n.to));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                  {n.to === "/notifications" && !!meta.data?.unread && (
                    <span
                      className={cn(
                        "ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        active
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-destructive text-destructive-foreground",
                      )}
                    >
                      {meta.data.unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg border border-border bg-paper p-4 text-xs text-muted-foreground">
            <p className="font-display text-sm font-semibold text-ink">DRRM Hotline</p>
            <p className="mt-1">For life-threatening emergencies, dial <span className="font-semibold text-ink">911</span> or call the City DRRM Operations Center at <span className="font-semibold text-ink">(02) 8888-0911</span>.</p>
          </div>
        </aside>
        {open && (
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
        )}

        {/* Main */}
        <main className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

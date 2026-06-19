import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SagipLogo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Workflow,
  HandHeart,
  Users,
  ScrollText,
  ArrowLeftRight,
  LogOut,
  Menu,
  Bell,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useIsSuperAdmin } from "@/lib/auth/use-role";

type NavItem = { to: string; label: string; icon: any; exact?: boolean; superOnly?: boolean };
const nav: NavItem[] = [
  { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/admin/operations", label: "Operations", icon: Workflow },
  { to: "/admin/donations", label: "Donations", icon: HandHeart },
  { to: "/admin/transactions", label: "Transaction history", icon: ArrowLeftRight },
  { to: "/admin/users", label: "Users & roles", icon: Users },
  { to: "/profile", label: "My profile", icon: User },
];


export function AdminShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const { isSuperAdmin } = useIsSuperAdmin();

  const meta = useQuery({
    queryKey: ["admin-shell-meta"],
    queryFn: async () => {
      const [profile, pending] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name").maybeSingle(),
        supabase.from("fund_requests").select("id", { count: "exact", head: true }).in("status", ["pending", "under_review"]),
      ]);
      return { profile: profile.data, pending: pending.count ?? 0 };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-shell")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin-shell-meta"] }),
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

  const name = meta.data?.profile ? `${meta.data.profile.first_name} ${meta.data.profile.last_name}` : "Administrator";

  return (
    <div className="min-h-screen bg-ink text-paper">
      <div className="h-1 bg-gradient-to-r from-gold via-relief to-primary" />
      <header className="sticky top-0 z-30 border-b border-white/10 bg-ink/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button className="rounded-md p-2 hover:bg-white/10 lg:hidden" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/admin" className="flex items-center gap-3">
              <SagipLogo variant="light" />
              <span className={cn("hidden rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] sm:inline", isSuperAdmin ? "border-relief/50 bg-relief/15 text-relief" : "border-gold/40 bg-gold/10 text-gold")}>{isSuperAdmin ? "Super Admin" : "Admin Console"}</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm font-medium text-paper/90 sm:inline">{name}</span>
            <Button variant="outline" size="sm" onClick={onSignOut} className="border-white/20 bg-transparent text-paper hover:bg-white/10">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1500px] gap-6 px-4 py-6 lg:px-6">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r border-white/10 bg-ink p-4 transition-transform lg:static lg:translate-x-0 lg:bg-transparent lg:p-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <nav className="space-y-0.5">
            {nav.filter((n) => !n.superOnly || isSuperAdmin).map((n) => {
              const Icon = n.icon;
              const active = n.exact ? pathname === n.to : pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link
                  key={n.to}
                  to={n.to as any}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active ? "bg-gold/15 text-gold" : "text-paper/70 hover:bg-white/5 hover:text-paper",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                  {n.to === "/admin/operations" && !!meta.data?.pending && (
                    <span className="ml-auto rounded-full bg-warning px-1.5 py-0.5 text-[10px] font-semibold text-warning-foreground">{meta.data.pending}</span>
                  )}

                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-paper/70">
            <p className="font-display text-sm font-semibold text-paper">Operational note</p>
            <p className="mt-1">Ensure compliance and accuracy for all financial approvals. Use the highest scrutiny when releasing funds.</p>
          </div>
        </aside>
        {open && <button aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 bg-black/60 lg:hidden" />}

        <main className="min-w-0 flex-1 rounded-xl bg-paper p-5 text-foreground shadow-2xl sm:p-7">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5">
            <div>
              <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
            {actions}
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}

export async function logAudit(action: string, entityType?: string, entityId?: string, metadata?: Record<string, unknown>) {
  // Handled automatically by database-level triggers
  return;
}

import { createFileRoute, Link, useRouter, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SagipLogo } from "@/components/sagip/Logo";
import { Button } from "@/components/ui/button";
import { formatPHP } from "@/lib/format";
import { Activity, HandHeart, FileText, Bell, User, LogOut, ShieldAlert, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SAGIP" }] }),
  component: Dashboard,
});

function Dashboard() {
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [donations, requests, allocations, disasters, profile, notif] = await Promise.all([
        supabase.from("donations").select("amount"),
        supabase.from("fund_requests").select("id,status"),
        supabase.from("fund_allocations").select("allocated_amount,released_amount"),
        supabase.from("disasters").select("id,name,city,severity,affected_families,required_funding,raised_amount,disaster_categories(name)").eq("status", "active").limit(5),
        supabase.from("profiles").select("first_name,last_name").maybeSingle(),
        supabase.from("notifications").select("id,is_read"),
      ]);
      const totalD = (donations.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalA = (allocations.data ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
      const totalR = (allocations.data ?? []).reduce((s, a) => s + Number(a.released_amount), 0);
      const pending = (requests.data ?? []).filter((r) => r.status === "pending" || r.status === "under_review").length;
      const unread = (notif.data ?? []).filter((n) => !n.is_read).length;
      return {
        totalDonations: totalD,
        availableFunds: Math.max(0, totalA - totalR),
        fundsReleased: totalR,
        fundsPending: pending,
        disasters: disasters.data ?? [],
        profile: profile.data,
        unread,
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "disasters" }, () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_allocations" }, () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const onSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const s = summary.data;
  const name = s?.profile ? `${s.profile.first_name} ${s.profile.last_name}` : "Citizen";

  return (
    <div className="min-h-screen bg-paper">
      <div className="gov-stripe" />
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
          <Link to="/"><SagipLogo /></Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Notifications">
              <Bell className="h-4 w-4" />
              {!!s?.unread && <span className="absolute mt-[-14px] ml-3 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">{s.unread}</span>}
            </Button>
            <Button variant="ghost" size="sm"><User className="h-4 w-4" /> {name}</Button>
            <Button variant="outline" size="sm" onClick={onSignOut}><LogOut className="h-4 w-4" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 lg:px-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Welcome, {name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live view of disaster relief fund operations.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Total donations received" value={formatPHP(s?.totalDonations ?? 0)} icon={HandHeart} accent="relief" />
          <KpiCard label="Available funds" value={formatPHP(s?.availableFunds ?? 0)} icon={TrendingUp} />
          <KpiCard label="Funds released" value={formatPHP(s?.fundsReleased ?? 0)} icon={Activity} accent="gold" />
          <KpiCard label="Requests pending" value={String(s?.fundsPending ?? 0)} icon={ShieldAlert} accent="warning" />
        </div>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-lg font-semibold">Active disasters</h2>
            <Button variant="ghost" size="sm">View all</Button>
          </div>
          <ul className="divide-y divide-border">
            {(s?.disasters ?? []).length === 0 && (
              <li className="p-10 text-center text-sm text-muted-foreground">No active disasters at this time.</li>
            )}
            {(s?.disasters ?? []).map((d: any) => {
              const pct = d.required_funding > 0 ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100) : 0;
              return (
                <li key={d.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.disaster_categories?.name}</p>
                    <p className="mt-0.5 font-display text-lg font-semibold">{d.name}</p>
                    <p className="text-sm text-muted-foreground">{d.city} · {d.affected_families.toLocaleString()} families affected</p>
                    <div className="mt-3 max-w-md">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="text-muted-foreground">Funding</span>
                        <span className="font-semibold tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full bg-relief" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="relief" size="sm"><HandHeart className="h-4 w-4" /> Donate</Button>
                    <Button variant="outline" size="sm"><FileText className="h-4 w-4" /> Request aid</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center">
          <h3 className="font-display text-lg font-semibold">More modules coming online</h3>
          <p className="mt-1 text-sm text-muted-foreground">Donation flow, fund-request submission, notifications inbox, and the admin console will be enabled in the next phase.</p>
        </section>
      </main>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: "relief" | "gold" | "warning" }) {
  const bar = accent === "relief" ? "bg-relief" : accent === "gold" ? "bg-gold" : accent === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5">
      <div className={`absolute left-0 top-0 h-full w-1 ${bar}`} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

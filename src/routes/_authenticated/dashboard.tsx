import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatPHP, timeAgo } from "@/lib/format";
import { Activity, HandHeart, FileText, ShieldAlert, TrendingUp, ArrowRight } from "lucide-react";
import { DashShell } from "@/components/sagip/DashShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SAGIP" }] }),
  component: Dashboard,
});

function Dashboard() {
  const queryClient = useQueryClient();

  const summary = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [donations, requests, allocations, disasters, myDonations, myRequests] = await Promise.all([
        supabase.from("donations").select("amount"),
        supabase.from("fund_requests").select("id,status"),
        supabase.from("fund_allocations").select("allocated_amount,released_amount"),
        supabase
          .from("disasters")
          .select("id,name,city,severity,affected_families,required_funding,raised_amount,disaster_categories(name)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.from("donations").select("id,amount,created_at,disasters(name)").order("created_at", { ascending: false }).limit(5),
        supabase.from("fund_requests").select("id,disaster_description,status,requested_amount,created_at").order("created_at", { ascending: false }).limit(5),
      ]);
      const totalD = (donations.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalA = (allocations.data ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
      const totalR = (allocations.data ?? []).reduce((s, a) => s + Number(a.released_amount), 0);
      const pending = (requests.data ?? []).filter((r) => r.status === "pending" || r.status === "under_review").length;
      return {
        totalDonations: totalD,
        availableFunds: Math.max(0, totalA - totalR),
        fundsReleased: totalR,
        fundsPending: pending,
        disasters: disasters.data ?? [],
        myDonations: myDonations.data ?? [],
        myRequests: myRequests.data ?? [],
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

  const s = summary.data;

  return (
    <DashShell title="Citizen dashboard" subtitle="Live view of city disaster relief fund operations.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total donations received" value={formatPHP(s?.totalDonations ?? 0)} icon={HandHeart} accent="relief" />
        <KpiCard label="Available funds" value={formatPHP(s?.availableFunds ?? 0)} icon={TrendingUp} />
        <KpiCard label="Funds released" value={formatPHP(s?.fundsReleased ?? 0)} icon={Activity} accent="gold" />
        <KpiCard label="Requests pending" value={String(s?.fundsPending ?? 0)} icon={ShieldAlert} accent="warning" />
      </div>

      <section className="mt-8 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">Active disasters</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/disasters">View all <ArrowRight className="h-3 w-3" /></Link>
          </Button>
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
                  <Button variant="relief" size="sm" asChild>
                    <Link to="/donate" search={{ disaster: d.id } as any}><HandHeart className="h-4 w-4" /> Donate</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/request" search={{ disaster: d.id } as any}><FileText className="h-4 w-4" /> Request aid</Link>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-base font-semibold">Your recent donations</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/donate">Donate again</Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {(s?.myDonations ?? []).length === 0 && (
              <li className="p-8 text-center text-sm text-muted-foreground">No donations yet. Your contributions will appear here.</li>
            )}
            {(s?.myDonations ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{d.disasters?.name ?? "General fund"}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(d.created_at)}</p>
                </div>
                <p className="font-display font-semibold tabular-nums text-relief">{formatPHP(d.amount)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-base font-semibold">Your assistance requests</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/requests">View all</Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {(s?.myRequests ?? []).length === 0 && (
              <li className="p-8 text-center text-sm text-muted-foreground">
                No requests yet. <Link to="/request" className="font-medium text-primary hover:underline">Submit your first request</Link>.
              </li>
            )}
            {(s?.myRequests ?? []).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.disaster_description}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)} · {formatPHP(r.requested_amount)}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashShell>
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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning-foreground",
    under_review: "bg-primary/10 text-primary",
    approved: "bg-relief/15 text-relief",
    rejected: "bg-destructive/15 text-destructive",
    fulfilled: "bg-gold/20 text-ink",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

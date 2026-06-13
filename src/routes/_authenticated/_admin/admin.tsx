import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/sagip/AdminShell";
import { formatPHP, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Activity, HandHeart, Wallet, AlertTriangle, ArrowRight, Users, Siren } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin")({
  head: () => ({ meta: [{ title: "Admin overview — SAGIP" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [donations, allocs, requests, disasters, users, recentReqs, recentDonations] = await Promise.all([
        supabase.from("donations").select("amount"),
        supabase.from("fund_allocations").select("allocated_amount,released_amount"),
        supabase.from("fund_requests").select("id,status"),
        supabase.from("disasters").select("id,status"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("fund_requests").select("id,disaster_description,requested_amount,status,created_at").order("created_at", { ascending: false }).limit(6),
        supabase.from("donations").select("id,donor_name,amount,created_at,is_anonymous,disasters(name)").order("created_at", { ascending: false }).limit(6),
      ]);
      const totalD = (donations.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalA = (allocs.data ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
      const totalR = (allocs.data ?? []).reduce((s, a) => s + Number(a.released_amount), 0);
      const pending = (requests.data ?? []).filter((r) => r.status === "pending" || r.status === "under_review").length;
      const activeDisasters = (disasters.data ?? []).filter((d) => d.status === "active").length;
      return {
        totalD, totalA, totalR, pending, activeDisasters,
        userCount: users.count ?? 0,
        recentReqs: recentReqs.data ?? [],
        recentDonations: recentDonations.data ?? [],
      };
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-overview-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_allocations" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "disasters" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const d = q.data;
  return (
    <AdminShell title="Operations overview" subtitle="Real-time view of fund operations, requests, and field activity.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Donations received" value={formatPHP(d?.totalD ?? 0)} accent="relief" icon={HandHeart} />
        <Kpi label="Funds allocated" value={formatPHP(d?.totalA ?? 0)} accent="primary" icon={Wallet} />
        <Kpi label="Funds released" value={formatPHP(d?.totalR ?? 0)} accent="gold" icon={Activity} />
        <Kpi label="Requests pending review" value={String(d?.pending ?? 0)} accent="warning" icon={AlertTriangle} />
        <Kpi label="Active disasters" value={String(d?.activeDisasters ?? 0)} icon={Siren} />
        <Kpi label="Registered users" value={String(d?.userCount ?? 0)} icon={Users} />
        <Kpi label="Available balance" value={formatPHP(Math.max(0, (d?.totalA ?? 0) - (d?.totalR ?? 0)))} accent="relief" icon={Wallet} />
        <Kpi label="Disbursement rate" value={d?.totalA ? Math.round(((d.totalR ?? 0) / d.totalA) * 100) + "%" : "0%"} icon={Activity} />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-base font-semibold">Recent requests</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/requests">Manage <ArrowRight className="h-3 w-3" /></Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {(d?.recentReqs ?? []).length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No requests yet.</li>}
            {(d?.recentReqs ?? []).map((r: any) => (
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
        <section className="rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-base font-semibold">Recent donations</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/donations">View all <ArrowRight className="h-3 w-3" /></Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {(d?.recentDonations ?? []).length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No donations recorded yet.</li>}
            {(d?.recentDonations ?? []).map((x: any) => (
              <li key={x.id} className="flex items-center justify-between p-4 text-sm">
                <div>
                  <p className="font-medium">{x.is_anonymous ? "Anonymous donor" : x.donor_name}</p>
                  <p className="text-xs text-muted-foreground">{x.disasters?.name ?? "General fund"} · {timeAgo(x.created_at)}</p>
                </div>
                <p className="font-display font-semibold tabular-nums text-relief">{formatPHP(x.amount)}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, accent, icon: Icon }: { label: string; value: string; accent?: "relief" | "gold" | "warning" | "primary"; icon: any }) {
  const bar = accent === "relief" ? "bg-relief" : accent === "gold" ? "bg-gold" : accent === "warning" ? "bg-warning" : accent === "primary" ? "bg-primary" : "bg-muted-foreground/40";
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
    released: "bg-gold/20 text-ink",
  };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "bg-secondary text-muted-foreground"}`}>{status.replace("_", " ")}</span>;
}

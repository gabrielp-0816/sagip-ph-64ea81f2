import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { formatPHP, timeAgo, formatDate } from "@/lib/format";
import { Activity, HandHeart, ShieldAlert, TrendingUp, ArrowRight, MapPin } from "lucide-react";
import { DashShell } from "@/components/sagip/DashShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SAGIP" }] }),
  component: Dashboard,
});

type DialogKind = null | "disasters" | "donations" | "requests";

function Dashboard() {
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState<DialogKind>(null);

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user;
    },
    staleTime: Infinity,
  });

  const uid = user?.id ?? "";

  const summary = useQuery({
    queryKey: ["dashboard-summary", uid],
    queryFn: async () => {
      if (!uid) {
        return {
          totalDonations: 0,
          availableFunds: 0,
          fundsReleased: 0,
          fundsPending: 0,
          disasters: [],
          myDonations: [],
          myRequests: [],
          uid: "",
        };
      }
      const [donations, requests, allocations, disasters, myDonations, myRequests] = await Promise.all([
        supabase.from("donations").select("amount"),
        supabase.from("fund_requests").select("id,status"),
        supabase.from("fund_allocations").select("allocated_amount,released_amount"),
        supabase
          .from("disasters")
          .select("id,name,city,severity,affected_families,required_funding,raised_amount,created_by,disaster_categories(name)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("donations").select("id,amount,created_at,disasters(name)").eq("donor_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("fund_requests").select("id,requester_id,disaster_description,status,requested_amount,created_at").eq("requester_id", uid).order("created_at", { ascending: false }).limit(5),
      ]);
      const totalD = (donations.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalA = (allocations.data ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
      const totalR = (allocations.data ?? []).reduce((s, a) => s + Number(a.released_amount), 0);
      const pending = (requests.data ?? []).filter((r) => r.status === "pending" || r.status === "under_review").length;
      // Exclude campaigns the current user created — they shouldn't donate to their own.
      const visibleDisasters = (disasters.data ?? []).filter((d: any) => d.created_by !== uid).slice(0, 5);
      return {
        totalDonations: totalD,
        availableFunds: Math.max(0, totalA - totalR),
        fundsReleased: totalR,
        fundsPending: pending,
        disasters: visibleDisasters,
        myDonations: myDonations.data ?? [],
        myRequests: (myRequests.data ?? []).filter((r: any) => r.requester_id === uid),
        uid,
      };
    },
    enabled: !!uid,
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
          <h2 className="font-display text-lg font-semibold">Active disaster campaigns</h2>
          <Button variant="ghost" size="sm" onClick={() => setOpenDialog("disasters")}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {(s?.disasters ?? []).length === 0 && (
            <li className="p-10 text-center text-sm text-muted-foreground">No active disaster campaigns at this time.</li>
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
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <Button variant="relief" size="sm" asChild>
                    <Link to="/donate" search={{ disaster: d.id } as any}><HandHeart className="h-4 w-4" /> Donate</Link>
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/request" search={{ disaster: d.id } as any}>Request aid</Link>
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
            <Button variant="ghost" size="sm" onClick={() => setOpenDialog("donations")}>View all <ArrowRight className="h-3 w-3" /></Button>
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
            <Button variant="ghost" size="sm" onClick={() => setOpenDialog("requests")}>View all <ArrowRight className="h-3 w-3" /></Button>
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

      <DisastersDialog open={openDialog === "disasters"} onOpenChange={(o) => !o && setOpenDialog(null)} />
      <DonationsDialog open={openDialog === "donations"} onOpenChange={(o) => !o && setOpenDialog(null)} uid={uid} />
      <RequestsDialog open={openDialog === "requests"} onOpenChange={(o) => !o && setOpenDialog(null)} uid={uid} />
    </DashShell>
  );
}

function DisastersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const q = useQuery({
    queryKey: ["dialog-all-disasters"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("disasters")
        .select("id,name,city,severity,status,affected_families,required_funding,raised_amount,occurred_at,disaster_categories(name)")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>Active disaster campaigns</DialogTitle>
          <DialogDescription>All disaster campaigns currently under response.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto">
          {q.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && (q.data ?? []).length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No active campaigns.</p>
          )}
          <ul className="divide-y divide-border">
            {(q.data ?? []).map((d: any) => {
              const pct = d.required_funding > 0 ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100) : 0;
              return (
                <li key={d.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.disaster_categories?.name}</p>
                      <p className="mt-0.5 font-display text-base font-semibold">{d.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{d.city} · {d.affected_families.toLocaleString()} families</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase capitalize">{d.severity}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Funding</span>
                      <span className="font-semibold tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-relief" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DonationsDialog({ open, onOpenChange, uid }: { open: boolean; onOpenChange: (o: boolean) => void; uid: string }) {
  const q = useQuery({
    queryKey: ["dialog-my-donations", uid],
    enabled: open && !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("donations")
        .select("id,amount,created_at,payment_method,reference_number,disasters(name)")
        .eq("donor_id", uid)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>Your recent donations</DialogTitle>
          <DialogDescription>Complete history of every donation you've made.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto">
          {q.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && (q.data ?? []).length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No donations yet.</p>
          )}
          <ul className="divide-y divide-border">
            {(q.data ?? []).map((d: any) => (
              <li key={d.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{d.disasters?.name ?? "General fund"}</p>
                  <p className="text-xs capitalize text-muted-foreground">
                    {formatDate(d.created_at)} · {(d.payment_method ?? "").replace(/_/g, " ")}
                    {d.reference_number ? ` · #${d.reference_number}` : ""}
                  </p>
                </div>
                <p className="font-display font-semibold tabular-nums text-relief">{formatPHP(d.amount)}</p>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RequestsDialog({ open, onOpenChange, uid }: { open: boolean; onOpenChange: (o: boolean) => void; uid: string }) {
  const q = useQuery({
    queryKey: ["dialog-my-requests", uid],
    enabled: open && !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("fund_requests")
        .select("id,requester_id,disaster_description,status,requested_amount,affected_individuals,city,barangay,created_at,disasters(name),disaster_categories(name)")
        .eq("requester_id", uid)
        .order("created_at", { ascending: false });
      return (data ?? []).filter((r: any) => r.requester_id === uid);
    },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>Your assistance requests</DialogTitle>
          <DialogDescription>All relief requests you've submitted and their status.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[65vh] overflow-y-auto">
          {q.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && (q.data ?? []).length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">
              No requests yet. <Link to="/request" className="font-medium text-primary hover:underline">Submit your first request</Link>.
            </p>
          )}
          <ul className="divide-y divide-border">
            {(q.data ?? []).map((r: any) => (
              <li key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{r.disaster_categories?.name} · {formatDate(r.created_at)}</p>
                    <p className="mt-0.5 font-medium">{r.disasters?.name ?? "Standalone request"}</p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.disaster_description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{r.barangay}, {r.city} · {r.affected_individuals?.toLocaleString?.() ?? 0} individuals</p>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={r.status} />
                    <p className="mt-1 font-display text-sm font-semibold tabular-nums">{formatPHP(r.requested_amount)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
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

import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatPHP, timeAgo, formatDate } from "@/lib/format";
import { Activity, HandHeart, ShieldAlert, TrendingUp, ArrowRight, MapPin, Search, Wallet, X } from "lucide-react";
import { DashShell } from "@/components/sagip/DashShell";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SAGIP" }] }),
  component: Dashboard,
});

type DialogKind = null | "disasters" | "inactive-disasters" | "donations" | "requests";

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
      const [donations, requests, allocations, disasters, inactiveDisasters, myDonations, myRequests] = await Promise.all([
        supabase.from("donations").select("amount"),
        supabase.from("fund_requests").select("id,status"),
        supabase.from("fund_allocations").select("disaster_id,allocated_amount,released_amount"),
        supabase
          .from("disasters")
          .select("id,name,city,severity,affected_families,required_funding,raised_amount,created_by,status,occurred_at,created_at,closure_requested,closure_requested_at,disaster_categories(name)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("disasters")
          .select("id,name,city,severity,affected_families,required_funding,raised_amount,created_by,status,disaster_categories(name)")
          .neq("status", "active")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("donations").select("id,amount,created_at,disasters(name)").eq("donor_id", uid).order("created_at", { ascending: false }).limit(5),
        supabase.from("fund_requests").select("id,requester_id,disaster_description,status,requested_amount,created_at").eq("requester_id", uid).order("created_at", { ascending: false }).limit(5),
      ]);

      const rawDisasters = disasters.data ?? [];
      const rawInactive = inactiveDisasters.data ?? [];

      const creatorIds = Array.from(
        new Set(
          [...rawDisasters.map((d: any) => d.created_by), ...rawInactive.map((d: any) => d.created_by)].filter(Boolean)
        )
      );

      let profilesById: Record<string, { first_name: string; last_name: string }> = {};
      if (creatorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,first_name,last_name")
          .in("id", creatorIds);
        if (profs) {
          profilesById = Object.fromEntries(profs.map((p: any) => [p.id, p]));
        }
      }

      const activeMapped = rawDisasters.map((d: any) => ({
        ...d,
        creator_profile: profilesById[d.created_by] || null,
      }));
      const inactiveMapped = rawInactive.map((d: any) => ({
        ...d,
        creator_profile: profilesById[d.created_by] || null,
      }));

      const totalD = (donations.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalA = (allocations.data ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
      const totalR = (allocations.data ?? []).reduce((s, a) => s + Number(a.released_amount), 0);
      const releasedByDisaster: Record<string, number> = {};
      for (const a of allocations.data ?? []) {
        if (!a.disaster_id) continue;
        releasedByDisaster[a.disaster_id] = (releasedByDisaster[a.disaster_id] ?? 0) + Number(a.released_amount);
      }
      const pending = (requests.data ?? []).filter((r) => r.status === "pending" || r.status === "under_review").length;
      // Exclude campaigns the current user created — they shouldn't donate to their own.
      const visibleDisasters = activeMapped.filter((d: any) => d.created_by !== uid);
      const myCampaigns = activeMapped.filter((d: any) => d.created_by === uid);
      const visibleInactive = inactiveMapped.filter((d: any) => d.created_by !== uid).slice(0, 5);
      return {
        totalDonations: totalD,
        availableFunds: Math.max(0, totalA - totalR),
        fundsReleased: totalR,
        fundsPending: pending,
        disasters: visibleDisasters,
        myCampaigns,
        inactiveDisasters: visibleInactive,
        releasedByDisaster,
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
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_releases" }, () => queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] }))
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

      <ActiveCampaignsSection
        disasters={(s?.disasters ?? []) as any[]}
        releasedByDisaster={s?.releasedByDisaster ?? {}}
        onViewAll={() => setOpenDialog("disasters")}
      />

      <MyCampaignsSection campaigns={(s?.myCampaigns ?? []) as any[]} />




      <section className="mt-8 rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold">Inactive disaster campaigns</h2>
          <Button variant="ghost" size="sm" onClick={() => setOpenDialog("inactive-disasters")}>
            View all <ArrowRight className="h-3 w-3" />
          </Button>
        </div>
        <ul className="divide-y divide-border">
          {(s?.inactiveDisasters ?? []).length === 0 && (
            <li className="p-10 text-center text-sm text-muted-foreground">No inactive disaster campaigns at this time.</li>
          )}
          {(s?.inactiveDisasters ?? []).map((d: any) => {
            const pct = d.required_funding > 0 ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100) : 0;
            return (
              <li key={d.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.disaster_categories?.name}</p>
                  <p className="mt-0.5 font-display text-lg font-semibold">{d.name}</p>
                  <p className="text-sm text-muted-foreground">{d.city} · {d.affected_families.toLocaleString()} families affected</p>
                  <div className="mt-3 max-w-md">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Final funding</span>
                      <span className="font-semibold tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-muted-foreground" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                  <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase capitalize">{d.status}</span>
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
      <InactiveDisastersDialog open={openDialog === "inactive-disasters"} onOpenChange={(o) => !o && setOpenDialog(null)} />
      <DonationsDialog open={openDialog === "donations"} onOpenChange={(o) => !o && setOpenDialog(null)} uid={uid} />
      <RequestsDialog open={openDialog === "requests"} onOpenChange={(o) => !o && setOpenDialog(null)} uid={uid} />

    </DashShell>
  );
}

function MyCampaignsSection({ campaigns }: { campaigns: any[] }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState<any | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!campaigns || campaigns.length === 0) return null;

  const submitClosure = async () => {
    if (!target) return;
    if (!reason.trim()) return toast.error("Please share why you'd like this campaign closed.");
    setSubmitting(true);
    const { error } = await supabase.rpc("request_campaign_closure", { _disaster_id: target.id, _reason: reason.trim() });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Closure request submitted. An admin will review it shortly.");
    setTarget(null);
    setReason("");
    qc.invalidateQueries({ queryKey: ["dashboard-summary"] });
  };

  return (
    <section className="mt-8 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">My campaigns</h2>
          <p className="text-xs text-muted-foreground">Campaigns started from your assistance requests.</p>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {campaigns.map((d: any) => {
          const pct = d.required_funding > 0 ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100) : 0;
          return (
            <li key={d.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.disaster_categories?.name}</p>
                <p className="mt-0.5 font-display text-lg font-semibold">{d.name}</p>
                <p className="text-sm text-muted-foreground">{d.city} · {d.affected_families?.toLocaleString?.() ?? d.affected_families} families affected</p>
                <div className="mt-3 max-w-md">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">Raised</span>
                    <span className="font-semibold tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-gradient-to-r from-relief to-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                {d.closure_requested ? (
                  <span className="inline-flex items-center justify-center rounded-full bg-warning/15 px-3 py-1 text-[10px] font-semibold uppercase text-warning-foreground">
                    Closure requested
                  </span>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => { setTarget(d); setReason(""); }}>
                    <X className="h-3.5 w-3.5" /> Request to close
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request to close campaign</DialogTitle>
            <DialogDescription>
              Admins will be notified to review and close <span className="font-medium">{target?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Reason for closing *</Label>
            <Textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. our community has recovered and no longer needs additional aid" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)}>Cancel</Button>
            <Button onClick={submitClosure} disabled={submitting}>Submit closure request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}


function ActiveCampaignsSection({
  disasters,
  releasedByDisaster,
  onViewAll,
}: {
  disasters: any[];
  releasedByDisaster: Record<string, number>;
  onViewAll: () => void;
}) {
  const [name, setName] = useState("");
  const [severity, setSeverity] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc" | "funded_desc">("date_desc");

  const severityOptions = useMemo(
    () => Array.from(new Set(disasters.map((d) => d.severity).filter(Boolean))) as string[],
    [disasters],
  );

  const filtered = useMemo(() => {
    return disasters
      .filter((d) => severity === "all" || d.severity === severity)
      .filter((d) => !name.trim() || d.name?.toLowerCase().includes(name.trim().toLowerCase()))
      .filter((d) => {
        const ref = d.occurred_at ?? d.created_at;
        if (!ref) return true;
        const t = new Date(ref).getTime();
        if (from && t < new Date(from).getTime()) return false;
        return true;
      })
      .sort((a, b) => {
        if (sort === "name_asc") return a.name.localeCompare(b.name);
        if (sort === "name_desc") return b.name.localeCompare(a.name);
        if (sort === "funded_desc") {
          const pa = a.required_funding > 0 ? Number(a.raised_amount) / Number(a.required_funding) : 0;
          const pb = b.required_funding > 0 ? Number(b.raised_amount) / Number(b.required_funding) : 0;
          return pb - pa;
        }
        const av = new Date(a.occurred_at ?? a.created_at).getTime();
        const bv = new Date(b.occurred_at ?? b.created_at).getTime();
        return sort === "date_asc" ? av - bv : bv - av;
      });
  }, [disasters, severity, name, from, sort]);

  const reset = () => { setName(""); setSeverity("all"); setFrom(""); setSort("date_desc"); };
  const visible = filtered.slice(0, 5);

  return (
    <section className="mt-8 rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border p-5">
        <h2 className="font-display text-lg font-semibold">Active disaster campaigns</h2>
        <Button variant="ghost" size="sm" onClick={onViewAll}>
          View all <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="border-b border-border bg-muted/30 p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 pl-8" />
          </div>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All severities</SelectItem>
              {severityOptions.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" aria-label="Date" />
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <Select value={sort} onValueChange={(v) => setSort(v as any)}>
            <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="date_desc">Newest first</SelectItem>
              <SelectItem value="date_asc">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name (A–Z)</SelectItem>
              <SelectItem value="name_desc">Name (Z–A)</SelectItem>
              <SelectItem value="funded_desc">Most funded</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{Math.min(visible.length, filtered.length)} of {filtered.length}</span>
            <Button variant="ghost" size="sm" className="h-8" onClick={reset}>Reset</Button>
          </div>
        </div>
      </div>
      <ul className="divide-y divide-border">
        {disasters.length === 0 && (
          <li className="p-10 text-center text-sm text-muted-foreground">No active disaster campaigns at this time.</li>
        )}
        {disasters.length > 0 && filtered.length === 0 && (
          <li className="p-10 text-center text-sm text-muted-foreground">No campaigns match these filters.</li>
        )}
        {visible.map((d: any) => {
          const pct = d.required_funding > 0 ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100) : 0;
          const released = releasedByDisaster[d.id] ?? 0;
          return (
            <li key={d.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.disaster_categories?.name}</p>
                <p className="mt-0.5 font-display text-lg font-semibold">{d.name}</p>
                <p className="text-sm text-muted-foreground">{d.city} · {d.affected_families.toLocaleString()} families affected</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Requested by <span className="font-semibold text-foreground">{d.creator_profile ? `${d.creator_profile.first_name} ${d.creator_profile.last_name}` : "Citizen"}</span> · {formatDate(d.created_at)}
                </p>
                <div className="mt-3 max-w-md">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">Funding</span>
                    <span className="font-semibold tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-relief" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Wallet className="h-3 w-3 text-gold" />
                    <span>Released to citizens: <span className="font-semibold tabular-nums text-foreground">{formatPHP(released)}</span></span>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:flex-col sm:items-stretch">
                <Button variant="relief" size="sm" asChild>
                  <Link to="/donate" search={{ disaster: d.id } as any}><HandHeart className="h-4 w-4" /> Donate</Link>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
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

function InactiveDisastersDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [status, setStatus] = useState<string>("all");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sort, setSort] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc">("date_desc");

  const q = useQuery({
    queryKey: ["dialog-inactive-disasters"],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("disasters")
        .select("id,name,city,severity,status,affected_families,required_funding,raised_amount,occurred_at,created_at,disaster_categories(name)")
        .neq("status", "active")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const all = q.data ?? [];
  const statusOptions = Array.from(new Set(all.map((d: any) => d.status).filter(Boolean))) as string[];

  const filtered = all
    .filter((d: any) => status === "all" || d.status === status)
    .filter((d: any) => !name.trim() || d.name?.toLowerCase().includes(name.trim().toLowerCase()))
    .filter((d: any) => {
      const ref = d.occurred_at ?? d.created_at;
      if (!ref) return true;
      const t = new Date(ref).getTime();
      if (from && t < new Date(from).getTime()) return false;
      if (to && t > new Date(to).getTime() + 86_400_000 - 1) return false;
      return true;
    })
    .sort((a: any, b: any) => {
      if (sort === "name_asc") return a.name.localeCompare(b.name);
      if (sort === "name_desc") return b.name.localeCompare(a.name);
      const av = new Date(a.occurred_at ?? a.created_at).getTime();
      const bv = new Date(b.occurred_at ?? b.created_at).getTime();
      return sort === "date_asc" ? av - bv : bv - av;
    });

  const resetFilters = () => { setStatus("all"); setName(""); setFrom(""); setTo(""); setSort("date_desc"); };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border p-5">
          <DialogTitle>Inactive disaster campaigns</DialogTitle>
          <DialogDescription>Closed disaster campaigns shown for transparency.</DialogDescription>
        </DialogHeader>
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Campaign name" value={name} onChange={(e) => setName(e.target.value)} className="h-9 pl-8" />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" aria-label="From date" />
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" aria-label="To date" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Select value={sort} onValueChange={(v) => setSort(v as any)}>
              <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z–A)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{filtered.length} of {all.length}</span>
              <Button variant="ghost" size="sm" className="h-8" onClick={resetFilters}>Reset</Button>
            </div>
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto">
          {q.isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>}
          {!q.isLoading && filtered.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No campaigns match these filters.</p>
          )}
          <ul className="divide-y divide-border">
            {filtered.map((d: any) => {
              const pct = d.required_funding > 0 ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100) : 0;
              return (
                <li key={d.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{d.disaster_categories?.name}</p>
                      <p className="mt-0.5 font-display text-base font-semibold">{d.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{d.city} · {d.affected_families.toLocaleString()} families · {formatDate(d.occurred_at ?? d.created_at)}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase capitalize">{d.status?.replace(/_/g, " ")}</span>
                  </div>
                  <div className="mt-3">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Final funding</span>
                      <span className="font-semibold tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-muted-foreground" style={{ width: `${pct}%` }} />
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
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-md shadow-sm">
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

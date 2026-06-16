import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/sagip/AdminShell";
import { formatPHP, timeAgo } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HandHeart, Wallet, AlertTriangle, ArrowRight, Siren, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/")({
  head: () => ({ meta: [{ title: "Admin overview — SAGIP" }] }),
  component: AdminOverview,
});

function AdminOverview() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [donations, allocs, requests, disasters, activeDisastersFull, inactiveDisasters, recentReqs, recentDonations] = await Promise.all([
        supabase.from("donations").select("amount"),
        supabase.from("fund_allocations").select("disaster_id,allocated_amount,released_amount"),
        supabase.from("fund_requests").select("id,status"),
        supabase.from("disasters").select("id,status"),
        supabase
          .from("disasters")
          .select("id,name,city,severity,affected_families,required_funding,raised_amount,status,disaster_categories(name),occurred_at,created_at")
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("disasters")
          .select("id,name,city,severity,affected_families,required_funding,raised_amount,status,disaster_categories(name),occurred_at,created_at")
          .neq("status", "active")
          .order("created_at", { ascending: false })
          .limit(100),
        supabase.from("fund_requests").select("id,disaster_description,requested_amount,status,created_at").order("created_at", { ascending: false }).limit(5),
        supabase
          .from("donations")
          .select("id,amount,created_at,donor_name,donor_email,is_anonymous,disaster_id,disasters(name)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);

      const totalD = (donations.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
      const totalA = (allocs.data ?? []).reduce((s, a) => s + Number(a.allocated_amount), 0);
      const totalR = (allocs.data ?? []).reduce((s, a) => s + Number(a.released_amount), 0);
      const releasedByDisaster: Record<string, number> = {};
      for (const a of allocs.data ?? []) {
        if (!a.disaster_id) continue;
        releasedByDisaster[a.disaster_id] = (releasedByDisaster[a.disaster_id] ?? 0) + Number(a.released_amount);
      }
      const pending = (requests.data ?? []).filter((r) => r.status === "pending" || r.status === "under_review").length;
      const activeDisasters = (disasters.data ?? []).filter((d) => d.status === "active").length;
      return {
        totalD, totalR, pending, activeDisasters,
        available: Math.max(0, totalA - totalR),
        recentReqs: recentReqs.data ?? [],
        recentDonations: recentDonations.data ?? [],
        activeDisastersList: activeDisastersFull.data ?? [],
        inactiveDisasters: inactiveDisasters.data ?? [],
        releasedByDisaster,
      };

    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-overview-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_allocations" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_releases" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .on("postgres_changes", { event: "*", schema: "public", table: "disasters" }, () => qc.invalidateQueries({ queryKey: ["admin-overview"] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const d = q.data;

  const [iStatus, setIStatus] = useState<string>("all");
  const [iName, setIName] = useState("");
  const [iFrom, setIFrom] = useState("");
  const [iTo, setITo] = useState("");
  const [iSort, setISort] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc">("date_desc");

  const inactiveAll = (d?.inactiveDisasters ?? []) as any[];
  const inactiveStatusOptions = useMemo(
    () => Array.from(new Set(inactiveAll.map((x) => x.status).filter(Boolean))) as string[],
    [inactiveAll],
  );
  const inactiveFiltered = useMemo(() => {
    return inactiveAll
      .filter((x) => iStatus === "all" || x.status === iStatus)
      .filter((x) => !iName.trim() || x.name?.toLowerCase().includes(iName.trim().toLowerCase()))
      .filter((x) => {
        const ref = x.occurred_at ?? x.created_at;
        if (!ref) return true;
        const t = new Date(ref).getTime();
        if (iFrom && t < new Date(iFrom).getTime()) return false;
        if (iTo && t > new Date(iTo).getTime() + 86_400_000 - 1) return false;
        return true;
      })
      .sort((a, b) => {
        if (iSort === "name_asc") return a.name.localeCompare(b.name);
        if (iSort === "name_desc") return b.name.localeCompare(a.name);
        const av = new Date(a.occurred_at ?? a.created_at).getTime();
        const bv = new Date(b.occurred_at ?? b.created_at).getTime();
        return iSort === "date_asc" ? av - bv : bv - av;
      });
  }, [inactiveAll, iStatus, iName, iFrom, iTo, iSort]);
  const resetInactiveFilters = () => { setIStatus("all"); setIName(""); setIFrom(""); setITo(""); setISort("date_desc"); };

  // Active campaigns filter state
  const [aName, setAName] = useState("");
  const [aSeverity, setASeverity] = useState<string>("all");
  const [aFrom, setAFrom] = useState("");
  const [aTo, setATo] = useState("");
  const [aSort, setASort] = useState<"date_desc" | "date_asc" | "name_asc" | "name_desc" | "funded_desc">("date_desc");
  const activeAll = (d?.activeDisastersList ?? []) as any[];
  const released = (d?.releasedByDisaster ?? {}) as Record<string, number>;
  const activeSeverityOptions = useMemo(
    () => Array.from(new Set(activeAll.map((x) => x.severity).filter(Boolean))) as string[],
    [activeAll],
  );
  const activeFiltered = useMemo(() => {
    return activeAll
      .filter((x) => aSeverity === "all" || x.severity === aSeverity)
      .filter((x) => !aName.trim() || x.name?.toLowerCase().includes(aName.trim().toLowerCase()))
      .filter((x) => {
        const ref = x.occurred_at ?? x.created_at;
        if (!ref) return true;
        const t = new Date(ref).getTime();
        if (aFrom && t < new Date(aFrom).getTime()) return false;
        if (aTo && t > new Date(aTo).getTime() + 86_400_000 - 1) return false;
        return true;
      })
      .sort((a, b) => {
        if (aSort === "name_asc") return a.name.localeCompare(b.name);
        if (aSort === "name_desc") return b.name.localeCompare(a.name);
        if (aSort === "funded_desc") {
          const pa = a.required_funding > 0 ? Number(a.raised_amount) / Number(a.required_funding) : 0;
          const pb = b.required_funding > 0 ? Number(b.raised_amount) / Number(b.required_funding) : 0;
          return pb - pa;
        }
        const av = new Date(a.occurred_at ?? a.created_at).getTime();
        const bv = new Date(b.occurred_at ?? b.created_at).getTime();
        return aSort === "date_asc" ? av - bv : bv - av;
      });
  }, [activeAll, aSeverity, aName, aFrom, aTo, aSort]);
  const resetActiveFilters = () => { setAName(""); setASeverity("all"); setAFrom(""); setATo(""); setASort("date_desc"); };


  return (
    <AdminShell title="Operations overview" subtitle="A focused snapshot of fund operations and recent citizen donations.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Donations received" value={formatPHP(d?.totalD ?? 0)} accent="relief" icon={HandHeart} />
        <Kpi label="Funds released" value={formatPHP(d?.totalR ?? 0)} accent="gold" icon={Wallet} />
        <Kpi label="Active campaigns" value={String(d?.activeDisasters ?? 0)} icon={Siren} accent="primary" />
        <Kpi label="Requests pending" value={String(d?.pending ?? 0)} accent="warning" icon={AlertTriangle} />
      </div>

      <section className="mt-8 min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-base font-semibold">Active disaster campaigns</h2>
          <Button variant="ghost" size="sm" asChild><Link to="/admin/operations">Manage <ArrowRight className="h-3 w-3" /></Link></Button>
        </div>
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Campaign name" value={aName} onChange={(e) => setAName(e.target.value)} className="h-9 pl-8" />
            </div>
            <Select value={aSeverity} onValueChange={setASeverity}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {activeSeverityOptions.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={aFrom} onChange={(e) => setAFrom(e.target.value)} className="h-9" aria-label="From date" />
            <Input type="date" value={aTo} onChange={(e) => setATo(e.target.value)} className="h-9" aria-label="To date" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Select value={aSort} onValueChange={(v) => setASort(v as any)}>
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
              <span className="text-xs text-muted-foreground">{activeFiltered.length} of {activeAll.length}</span>
              <Button variant="ghost" size="sm" className="h-8" onClick={resetActiveFilters}>Reset</Button>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {activeAll.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No active campaigns.</li>}
          {activeAll.length > 0 && activeFiltered.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No campaigns match these filters.</li>}
          {activeFiltered.map((row: any) => {
            const pct = row.required_funding > 0 ? Math.min(100, (Number(row.raised_amount) / Number(row.required_funding)) * 100) : 0;
            const rel = released[row.id] ?? 0;
            return (
              <li key={row.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{row.disaster_categories?.name}</p>
                  <p className="mt-0.5 font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.city} · {row.affected_families.toLocaleString()} families · {timeAgo(row.occurred_at ?? row.created_at)}</p>
                  <div className="mt-2 max-w-md">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Funding</span>
                      <span className="font-semibold tabular-nums">{formatPHP(row.raised_amount)} / {formatPHP(row.required_funding, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-relief" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                      <Wallet className="h-3 w-3 text-gold" />
                      <span>Released to citizens: <span className="font-semibold tabular-nums text-foreground">{formatPHP(rel)}</span></span>
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase capitalize">{row.severity}</span>
              </li>
            );
          })}
        </ul>
      </section>


      <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <h2 className="font-display text-base font-semibold">Recent assistance requests</h2>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/operations">Manage <ArrowRight className="h-3 w-3" /></Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {(d?.recentReqs ?? []).length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No requests yet.</li>}
            {(d?.recentReqs ?? []).map((r: any) => (
              <li key={r.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.disaster_description}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)} · {formatPHP(r.requested_amount)}</p>
                </div>
                <StatusBadge status={r.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border p-5">
            <div className="flex items-center gap-2">
              <HandHeart className="h-4 w-4 text-relief" />
              <h2 className="font-display text-base font-semibold">Recent citizen donations</h2>
            </div>
            <Button variant="ghost" size="sm" asChild><Link to="/admin/donations">View all <ArrowRight className="h-3 w-3" /></Link></Button>
          </div>
          <ul className="divide-y divide-border">
            {(d?.recentDonations ?? []).length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No donations yet.</li>}
            {(d?.recentDonations ?? []).map((don: any) => {
              const campaign = don.disasters?.name ?? "General fund";
              const donor = don.is_anonymous ? "Anonymous" : don.donor_name;
              return (
                <li key={don.id} className="flex items-center justify-between gap-3 p-4 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{donor}</p>
                    <p className="truncate text-xs text-muted-foreground">{campaign} · {timeAgo(don.created_at)}</p>
                  </div>
                  <span className="shrink-0 text-right font-semibold tabular-nums text-relief">{formatPHP(don.amount)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-8 min-w-0 overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border p-5">
          <h2 className="font-display text-base font-semibold">Inactive / closed disaster campaigns</h2>
          <Button variant="ghost" size="sm" asChild><Link to="/admin/operations">Manage <ArrowRight className="h-3 w-3" /></Link></Button>
        </div>
        <div className="border-b border-border bg-muted/30 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Campaign name" value={iName} onChange={(e) => setIName(e.target.value)} className="h-9 pl-8" />
            </div>
            <Select value={iStatus} onValueChange={setIStatus}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {inactiveStatusOptions.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input type="date" value={iFrom} onChange={(e) => setIFrom(e.target.value)} className="h-9" aria-label="From date" />
            <Input type="date" value={iTo} onChange={(e) => setITo(e.target.value)} className="h-9" aria-label="To date" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <Select value={iSort} onValueChange={(v) => setISort(v as any)}>
              <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Newest first</SelectItem>
                <SelectItem value="date_asc">Oldest first</SelectItem>
                <SelectItem value="name_asc">Name (A–Z)</SelectItem>
                <SelectItem value="name_desc">Name (Z–A)</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{inactiveFiltered.length} of {inactiveAll.length}</span>
              <Button variant="ghost" size="sm" className="h-8" onClick={resetInactiveFilters}>Reset</Button>
            </div>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {inactiveAll.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No inactive campaigns.</li>}
          {inactiveAll.length > 0 && inactiveFiltered.length === 0 && <li className="p-8 text-center text-sm text-muted-foreground">No campaigns match these filters.</li>}
          {inactiveFiltered.map((row: any) => {
            const pct = row.required_funding > 0 ? Math.min(100, (Number(row.raised_amount) / Number(row.required_funding)) * 100) : 0;
            return (
              <li key={row.id} className="grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{row.disaster_categories?.name}</p>
                  <p className="mt-0.5 font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground">{row.city} · {row.affected_families.toLocaleString()} families · {timeAgo(row.occurred_at ?? row.created_at)}</p>
                  <div className="mt-2 max-w-md">
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-muted-foreground">Final funding</span>
                      <span className="font-semibold tabular-nums">{formatPHP(row.raised_amount)} / {formatPHP(row.required_funding, { compact: true })}</span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div className="h-full bg-muted-foreground" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
                <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold uppercase capitalize">{row.status?.replace(/_/g, " ")}</span>
              </li>
            );
          })}
        </ul>
      </section>
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

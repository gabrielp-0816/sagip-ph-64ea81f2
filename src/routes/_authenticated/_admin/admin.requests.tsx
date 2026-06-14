import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, logAudit } from "@/components/sagip/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPHP, formatDate, timeAgo } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, Send, Eye, ShieldCheck, Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/requests")({
  head: () => ({ meta: [{ title: "Assistance requests — SAGIP Admin" }] }),
  component: ManageRequests,
});

function ManageRequests() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "pending" | "under_review" | "approved" | "rejected" | "released">("pending");
  const [viewing, setViewing] = useState<any | null>(null);
  const [releaseFor, setReleaseFor] = useState<any | null>(null);
  const [releaseForm, setReleaseForm] = useState({ amount: "", allocation_id: "", reference_number: "", notes: "" });
  const [releaseProof, setReleaseProof] = useState<File | null>(null);

  const allocs = useQuery({ queryKey: ["allocs-available"], queryFn: async () => (await supabase.from("fund_allocations").select("id,label,allocated_amount,released_amount")).data ?? [] });

  const list = useQuery({
    queryKey: ["admin-requests", filter],
    queryFn: async () => {
      let q = supabase.from("fund_requests").select("*,disasters(name),disaster_categories(name)").order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.requester_id).filter(Boolean)));
      let profilesById: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase.from("profiles").select("id,first_name,last_name,mobile_number,email").in("id", ids);
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return rows.map((r: any) => ({ ...r, profiles: profilesById[r.requester_id] ?? null }));
    },
  });

  useEffect(() => {
    const ch = supabase.channel("admin-req-rt").on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () => qc.invalidateQueries({ queryKey: ["admin-requests"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const notify = async (userId: string, title: string, body: string, priority: "low" | "normal" | "high" | "critical" = "normal") => {
    await supabase.from("notifications").insert({ user_id: userId, title, body, priority, link: "/requests" });
  };

  const setStatus = async (r: any, status: string, notes?: string) => {
    const { data: u } = await supabase.auth.getUser();
    let linkedDisasterId: string | null = r.disaster_id ?? null;

    // On approval: if the request isn't already tied to a disaster campaign,
    // promote it into an active campaign so all citizens can see and donate.
    if (status === "approved" && !linkedDisasterId && r.category_id) {
      const campaignName = `${r.disaster_categories?.name ?? "Disaster"} relief — ${r.barangay}, ${r.city}`.slice(0, 120);
      const { data: created, error: dErr } = await supabase
        .from("disasters")
        .insert({
          name: campaignName,
          category_id: r.category_id,
          description: r.disaster_description,
          location: r.exact_location,
          city: r.city,
          barangay: r.barangay,
          severity: "moderate",
          status: "active",
          affected_individuals: r.affected_individuals ?? 0,
          affected_families: Math.max(1, Math.ceil((r.affected_individuals ?? 1) / 5)),
          required_funding: r.requested_amount ?? 0,
          occurred_at: r.created_at ?? new Date().toISOString(),
          created_by: u.user?.id ?? null,
        })
        .select("id")
        .single();
      if (dErr) return toast.error(`Could not create campaign: ${dErr.message}`);
      linkedDisasterId = created.id;
      await logAudit("disaster.create_from_request", "disasters", created.id, { request_id: r.id });
    }

    const { error } = await supabase
      .from("fund_requests")
      .update({
        status: status as any,
        reviewer_notes: notes ?? r.reviewer_notes,
        reviewed_by: u.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        ...(linkedDisasterId && !r.disaster_id ? { disaster_id: linkedDisasterId } : {}),
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAudit(`request.${status}`, "fund_requests", r.id, { notes });
    await notify(
      r.requester_id,
      `Your aid request has been ${status.replace("_", " ")}`,
      status === "approved" && linkedDisasterId && !r.disaster_id
        ? `A disaster campaign has been opened for your request. Citizens can now donate to support it.`
        : notes || `Request: ${r.disaster_description.slice(0, 80)}`,
      status === "rejected" ? "high" : "normal",
    );
    toast.success(`Request marked ${status}`);
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
    qc.invalidateQueries({ queryKey: ["admin-disasters"] });
    setViewing(null);
  };

  const release = async () => {
    if (!releaseFor) return;
    const amt = Number(releaseForm.amount);
    if (Number.isNaN(amt) || amt <= 0) return toast.error("Enter an amount greater than zero");
    if (!releaseProof) return toast.error("Upload a proof of release (receipt, signed acknowledgment, or supporting document)");

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? "system";

    // Upload proof to request-documents bucket under the requester's folder
    const safeName = releaseProof.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const proofPath = `${releaseFor.requester_id}/${releaseFor.id}/release-${Date.now()}-${safeName}`;
    const up = await supabase.storage.from("request-documents").upload(proofPath, releaseProof, { contentType: releaseProof.type });
    if (up.error) return toast.error(`Proof upload failed: ${up.error.message}`);

    const { error: insErr } = await supabase.from("fund_releases").insert({
      request_id: releaseFor.id,
      allocation_id: releaseForm.allocation_id || null,
      amount: amt,
      reference_number: releaseForm.reference_number || null,
      notes: releaseForm.notes || null,
      released_by: uid,
      proof_url: up.data.path,
    });
    if (insErr) return toast.error(insErr.message);
    if (releaseForm.allocation_id) {
      const alloc = (allocs.data ?? []).find((a) => a.id === releaseForm.allocation_id);
      if (alloc) {
        await supabase.from("fund_allocations").update({ released_amount: Number(alloc.released_amount) + amt }).eq("id", alloc.id);
      }
    }
    await supabase.from("fund_requests").update({ status: "released" }).eq("id", releaseFor.id);
    await logAudit("request.release", "fund_requests", releaseFor.id, { ...releaseForm, amount: amt, proof_url: up.data.path });
    await notify(releaseFor.requester_id, `Funds released for your request`, `${formatPHP(amt)} released. Reference: ${releaseForm.reference_number || "—"}`, "high");
    toast.success("Funds released with proof recorded");
    setReleaseFor(null);
    setReleaseForm({ amount: "", allocation_id: "", reference_number: "", notes: "" });
    setReleaseProof(null);
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
    qc.invalidateQueries({ queryKey: ["allocs-available"] });
  };

  const verify = async (r: any) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("fund_requests").update({
      verification_status: "verified",
      verified_by: u.user?.id ?? null,
      verified_at: new Date().toISOString(),
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAudit("request.verify", "fund_requests", r.id);
    toast.success("Disaster verified for this request");
    qc.invalidateQueries({ queryKey: ["admin-requests"] });
    setViewing((v: any) => v && v.id === r.id ? { ...v, verification_status: "verified" } : v);
  };

  return (
    <AdminShell title="Assistance requests" subtitle="Review citizen aid requests, approve, reject, and release funds.">
      <Tabs value={filter} onValueChange={(v: any) => setFilter(v)} className="mb-5">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="under_review">Under review</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="released">Released</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Requester</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Campaign</th>
              <th className="px-4 py-3 text-right">Requested</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(list.data ?? []).length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No requests found.</td></tr>}
            {(list.data ?? []).map((r: any) => (
              <tr key={r.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{r.profiles?.first_name} {r.profiles?.last_name}</p>
                  <p className="text-xs text-muted-foreground">{r.profiles?.mobile_number}</p>
                </td>
                <td className="px-4 py-3 text-xs">{r.barangay}, {r.city}</td>
                <td className="px-4 py-3 text-xs">{r.disasters?.name ?? r.disaster_categories?.name ?? "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatPHP(r.requested_amount)}</td>
                <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(r.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setViewing(r)}><Eye className="h-3.5 w-3.5" /> Review</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Review dialog */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Review request</DialogTitle></DialogHeader>
          {viewing && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Requester">{viewing.profiles?.first_name} {viewing.profiles?.last_name}</Info>
                <Info label="Contact">{viewing.profiles?.mobile_number} · {viewing.profiles?.email}</Info>
                <Info label="Location">{viewing.exact_location}, {viewing.barangay}, {viewing.city}</Info>
                <Info label="Submitted">{formatDate(viewing.created_at)}</Info>
                <Info label="Individuals affected">{viewing.affected_individuals}</Info>
                <Info label="Estimated damage">{formatPHP(viewing.estimated_damage_cost)}</Info>
                <Info label="Requested amount" highlight>{formatPHP(viewing.requested_amount)}</Info>
                <Info label="Status"><StatusBadge status={viewing.status} /></Info>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-paper p-3 text-sm">{viewing.disaster_description}</p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Reviewer notes</Label>
                <Textarea className="mt-1" rows={3} defaultValue={viewing.reviewer_notes ?? ""} onBlur={(e) => setViewing({ ...viewing, reviewer_notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {viewing && viewing.status !== "released" && (
              <>
                {viewing.status === "pending" && <Button variant="outline" onClick={() => setStatus(viewing, "under_review")}>Mark under review</Button>}
                {viewing.status !== "rejected" && viewing.status !== "released" && <Button variant="destructive" onClick={() => setStatus(viewing, "rejected", viewing.reviewer_notes)}><X className="h-4 w-4" /> Reject</Button>}
                {viewing.status !== "approved" && viewing.status !== "released" && <Button variant="relief" onClick={() => setStatus(viewing, "approved", viewing.reviewer_notes)}><Check className="h-4 w-4" /> Approve</Button>}
                {viewing.status === "approved" && <Button onClick={() => { setReleaseFor(viewing); setReleaseForm({ amount: Number(viewing.requested_amount), allocation_id: "", reference_number: "", notes: "" }); setViewing(null); }}><Send className="h-4 w-4" /> Release funds</Button>}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Release dialog */}
      <Dialog open={!!releaseFor} onOpenChange={(o) => !o && setReleaseFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Release funds</DialogTitle></DialogHeader>
          {releaseFor && (
            <div className="grid gap-4 text-sm">
              <p className="rounded-md bg-secondary p-3 text-xs">For: <span className="font-medium">{releaseFor.profiles?.first_name} {releaseFor.profiles?.last_name}</span> · {formatPHP(releaseFor.requested_amount)} requested</p>
              <div><Label className="text-xs">Amount to release (₱) *</Label><Input className="mt-1" type="number" min="0" step="100" value={releaseForm.amount} onChange={(e) => setReleaseForm({ ...releaseForm, amount: Number(e.target.value) })} /></div>
              <div>
                <Label className="text-xs">Charge against allocation</Label>
                <Select value={releaseForm.allocation_id || "_none"} onValueChange={(v) => setReleaseForm({ ...releaseForm, allocation_id: v === "_none" ? "" : v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— General fund —</SelectItem>
                    {(allocs.data ?? []).map((a) => {
                      const avail = Number(a.allocated_amount) - Number(a.released_amount);
                      return <SelectItem key={a.id} value={a.id}>{a.label} · {formatPHP(avail)} available</SelectItem>;
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Reference number</Label><Input className="mt-1" value={releaseForm.reference_number} onChange={(e) => setReleaseForm({ ...releaseForm, reference_number: e.target.value })} placeholder="DV / cheque / transfer #" /></div>
              <div><Label className="text-xs">Notes</Label><Textarea className="mt-1" rows={2} value={releaseForm.notes} onChange={(e) => setReleaseForm({ ...releaseForm, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseFor(null)}>Cancel</Button>
            <Button onClick={release}><Send className="h-4 w-4" /> Confirm release</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Info({ label, children, highlight }: { label: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p className={`mt-0.5 ${highlight ? "font-display text-lg font-semibold text-relief" : "font-medium"}`}>{children}</p>
    </div>
  );
}
function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = { pending: "bg-warning/15 text-warning-foreground", under_review: "bg-primary/10 text-primary", approved: "bg-relief/15 text-relief", rejected: "bg-destructive/15 text-destructive", released: "bg-gold/20 text-ink" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m[status] ?? "bg-secondary"}`}>{status.replace("_", " ")}</span>;
}

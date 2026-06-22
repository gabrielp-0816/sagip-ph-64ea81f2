import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, logAudit } from "@/components/sagip/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  X,
  Check,
  Send,
  Eye,
  ShieldCheck,
  Upload,
  Wallet,
  ClipboardCheck,
  Siren,
  Search,
} from "lucide-react";
import { formatPHP, formatDate, timeAgo } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/operations")({
  head: () => ({ meta: [{ title: "Operations — SAGIP Admin" }] }),
  component: Operations,
});

type CampaignForm = {
  id?: string;
  name: string;
  category_id: string;
  description: string;
  location: string;
  city: string;
  barangay: string;
  severity: "low" | "moderate" | "high" | "critical";
  status: "active" | "monitoring" | "closed";
  affected_families: string;
  affected_individuals: string;
  required_funding: string;
  occurred_at: string;
};

const blankCampaign = (): CampaignForm => ({
  name: "",
  category_id: "",
  description: "",
  location: "",
  city: "",
  barangay: "",
  severity: "moderate",
  status: "active",
  affected_families: "",
  affected_individuals: "",
  required_funding: "",
  occurred_at: new Date().toISOString().slice(0, 10),
});

function Operations() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "monitoring" | "closed">("active");
  const [search, setSearch] = useState("");

  const [editingCampaign, setEditingCampaign] = useState<CampaignForm | null>(null);
  const [allocFor, setAllocFor] = useState<any | null>(null);
  const [allocForm, setAllocForm] = useState({ label: "", allocated_amount: "", notes: "" });

  const [reviewing, setReviewing] = useState<any | null>(null);
  const [linkToCampaignId, setLinkToCampaignId] = useState<string>("_new");
  const [releaseFor, setReleaseFor] = useState<any | null>(null);
  const [releaseForm, setReleaseForm] = useState({
    amount: "",
    allocation_id: "",
    reference_number: "",
    notes: "",
  });
  const [releaseProof, setReleaseProof] = useState<File | null>(null);
  const [createAllocationInline, setCreateAllocationInline] = useState(false);
  const [inlineAllocLabel, setInlineAllocLabel] = useState("");

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("disaster_categories").select("*").order("name")).data ?? [],
  });

  const campaigns = useQuery({
    queryKey: ["ops-disasters"],
    queryFn: async () =>
      (
        await supabase
          .from("disasters")
          .select("*,disaster_categories(name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const allocs = useQuery({
    queryKey: ["ops-allocations"],
    queryFn: async () =>
      (
        await supabase
          .from("fund_allocations")
          .select("*")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const requests = useQuery({
    queryKey: ["ops-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("fund_requests")
        .select("*,disaster_categories(name)")
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r: any) => r.requester_id).filter(Boolean)));
      let profilesById: Record<string, any> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id,first_name,last_name,mobile_number,email")
          .in("id", ids);
        profilesById = Object.fromEntries((profs ?? []).map((p: any) => [p.id, p]));
      }
      return rows.map((r: any) => ({ ...r, profiles: profilesById[r.requester_id] ?? null }));
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("ops-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_requests" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-requests"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "disasters" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-disasters"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_allocations" }, () =>
        qc.invalidateQueries({ queryKey: ["ops-allocations"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  useEffect(() => {
    if (reviewing) {
      setLinkToCampaignId(reviewing.disaster_id || "_new");
    }
  }, [reviewing]);

  useEffect(() => {
    if (releaseFor) {
      const name =
        `${releaseFor.profiles?.first_name ?? ""} ${releaseFor.profiles?.last_name ?? ""}`.trim();
      setInlineAllocLabel(name ? `${name} Relief` : "Aid Request Relief");
      setCreateAllocationInline(false);
    }
  }, [releaseFor]);

  const filteredCampaigns = useMemo(() => {
    let list = campaigns.data ?? [];
    if (filter !== "all") list = list.filter((d: any) => d.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((d: any) =>
        `${d.name} ${d.city} ${d.barangay ?? ""}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [campaigns.data, filter, search]);

  const unassignedRequests = useMemo(
    () =>
      (requests.data ?? []).filter(
        (r: any) => !r.disaster_id && r.status !== "rejected" && r.status !== "released",
      ),
    [requests.data],
  );

  const requestsByCampaign = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const r of requests.data ?? []) if (r.disaster_id) (map[r.disaster_id] ??= []).push(r);
    return map;
  }, [requests.data]);

  const allocsByCampaign = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const a of allocs.data ?? []) if (a.disaster_id) (map[a.disaster_id] ??= []).push(a);
    return map;
  }, [allocs.data]);

  const notify = async (
    userId: string,
    title: string,
    body: string,
    priority: "low" | "normal" | "high" | "critical" = "normal",
  ) => {
    await supabase
      .from("notifications")
      .insert({ user_id: userId, title, body, priority, link: "/requests" });
  };

  // ---------- Campaign save ----------
  const saveCampaign = async () => {
    if (!editingCampaign) return;
    const e = editingCampaign;
    if (!e.name || !e.category_id || !e.location || !e.city || !e.occurred_at)
      return toast.error("Please fill required fields");
    const families = Number(e.affected_families);
    const individuals = Number(e.affected_individuals);
    const funding = Number(e.required_funding);
    if (Number.isNaN(families) || families < 0)
      return toast.error("Affected families must be a valid number");
    if (Number.isNaN(individuals) || individuals < 0)
      return toast.error("Affected individuals must be a valid number");
    if (Number.isNaN(funding) || funding < 0)
      return toast.error("Required funding must be a valid number");
    const payload = {
      name: e.name,
      category_id: e.category_id,
      description: e.description || null,
      location: e.location,
      city: e.city,
      barangay: e.barangay || null,
      severity: e.severity,
      status: e.status,
      affected_families: families,
      affected_individuals: individuals,
      required_funding: funding,
      occurred_at: new Date(e.occurred_at).toISOString(),
    };
    if (e.id) {
      const { error } = await supabase.from("disasters").update(payload).eq("id", e.id);
      if (error) return toast.error(error.message);
      await logAudit("disaster.update", "disasters", e.id, payload);
      toast.success("Campaign updated");
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("disasters")
        .insert({ ...payload, created_by: u.user?.id ?? null })
        .select("id")
        .single();
      if (error) return toast.error(error.message);
      await logAudit("disaster.create", "disasters", data?.id, payload);
      toast.success("Campaign created");
    }
    setEditingCampaign(null);
    qc.invalidateQueries({ queryKey: ["ops-disasters"] });
  };

  const closeCampaign = async (id: string) => {
    if (!confirm("Close this campaign? It will no longer accept new donations or requests."))
      return;
    const { error } = await supabase
      .from("disasters")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("disaster.close", "disasters", id);
    toast.success("Campaign closed");
    qc.invalidateQueries({ queryKey: ["ops-disasters"] });
  };

  // ---------- Allocation create ----------
  const createAllocation = async () => {
    if (!allocFor) return;
    const amt = Number(allocForm.allocated_amount);
    if (!allocForm.label) return toast.error("Provide a label");
    if (Number.isNaN(amt) || amt <= 0) return toast.error("Enter a positive amount");
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("fund_allocations")
      .insert({
        label: allocForm.label,
        category_id: allocFor.category_id ?? null,
        disaster_id: allocFor.id,
        allocated_amount: amt,
        notes: allocForm.notes || null,
        created_by: u.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) return toast.error(error.message);
    await logAudit("allocation.create", "fund_allocations", data?.id, {
      ...allocForm,
      disaster_id: allocFor.id,
    });
    toast.success("Allocation created");
    setAllocFor(null);
    setAllocForm({ label: "", allocated_amount: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["ops-allocations"] });
  };

  // ---------- Request status ----------
  const setRequestStatus = async (r: any, status: string, notes?: string, andRelease = false) => {
    const { data: u } = await supabase.auth.getUser();
    let linkedDisasterId: string | null = r.disaster_id ?? null;
    const isApproved = status === "approved";

    if (isApproved && !linkedDisasterId && r.category_id) {
      if (linkToCampaignId && linkToCampaignId !== "_new") {
        linkedDisasterId = linkToCampaignId;
      } else {
        const campaignName =
          `${r.disaster_categories?.name ?? "Disaster"} relief — ${r.barangay}, ${r.city}`.slice(
            0,
            120,
          );
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
            created_by: r.requester_id ?? u.user?.id ?? null,
          })
          .select("id")
          .single();
        if (dErr) return toast.error(`Could not create campaign: ${dErr.message}`);
        linkedDisasterId = created.id;
        await logAudit("disaster.create_from_request", "disasters", created.id, {
          request_id: r.id,
        });
      }
    }

    const { error } = await supabase
      .from("fund_requests")
      .update({
        status: status as any,
        reviewer_notes: notes ?? r.reviewer_notes,
        reviewed_by: u.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        ...(linkedDisasterId && !r.disaster_id ? { disaster_id: linkedDisasterId } : {}),
        ...(isApproved
          ? {
              verification_status: "verified",
              verified_by: u.user?.id ?? null,
              verified_at: new Date().toISOString(),
            }
          : {}),
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAudit(`request.${status}`, "fund_requests", r.id, { notes });
    await notify(
      r.requester_id,
      `Your aid request has been ${status.replace("_", " ")}`,
      status === "approved" && linkedDisasterId && !r.disaster_id
        ? "A disaster campaign has been opened for your request. Citizens can now donate to support it."
        : notes || `Request: ${(r.disaster_description ?? "").slice(0, 80)}`,
      status === "rejected" ? "high" : "normal",
    );
    toast.success(`Request marked ${status.replace("_", " ")}`);
    qc.invalidateQueries({ queryKey: ["ops-requests"] });
    qc.invalidateQueries({ queryKey: ["ops-disasters"] });

    if (andRelease && isApproved) {
      setReleaseFor({
        ...r,
        status: "approved",
        disaster_id: linkedDisasterId,
      });
      setReleaseForm({
        amount: String(r.requested_amount ?? ""),
        allocation_id: "",
        reference_number: "",
        notes: "",
      });
      setReleaseProof(null);
      setReviewing(null);
    } else {
      setReviewing(null);
    }
  };

  const verifyRequest = async (r: any) => {
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fund_requests")
      .update({
        verification_status: "verified",
        verified_by: u.user?.id ?? null,
        verified_at: new Date().toISOString(),
      })
      .eq("id", r.id);
    if (error) return toast.error(error.message);
    await logAudit("request.verify", "fund_requests", r.id);
    toast.success("Disaster verified for this request");
    qc.invalidateQueries({ queryKey: ["ops-requests"] });
    setReviewing((v: any) => (v && v.id === r.id ? { ...v, verification_status: "verified" } : v));
  };

  // ---------- Release ----------
  const release = async () => {
    if (!releaseFor) return;
    const amt = Number(releaseForm.amount);
    if (Number.isNaN(amt) || amt <= 0) return toast.error("Enter an amount greater than zero");

    if (createAllocationInline && !inlineAllocLabel.trim()) {
      return toast.error("Provide a label for the new allocation");
    }

    if (!createAllocationInline && releaseForm.allocation_id) {
      const alloc = (allocs.data ?? []).find((a) => a.id === releaseForm.allocation_id);
      if (alloc) {
        const avail = Number(alloc.allocated_amount) - Number(alloc.released_amount);
        if (amt > avail) {
          return toast.error(
            `Insufficient funds in selected allocation. Only ${formatPHP(avail)} available.`,
          );
        }
      }
    }

    if (!releaseProof) return toast.error("Upload a proof of release");

    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id ?? "system";
    const safeName = releaseProof.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const proofPath = `${releaseFor.requester_id}/${releaseFor.id}/release-${Date.now()}-${safeName}`;
    const up = await supabase.storage
      .from("request-documents")
      .upload(proofPath, releaseProof, { contentType: releaseProof.type });
    if (up.error) return toast.error(`Proof upload failed: ${up.error.message}`);

    let targetAllocationId: string | null = null;
    if (createAllocationInline) {
      const { data: newAlloc, error: allocErr } = await supabase
        .from("fund_allocations")
        .insert({
          label: inlineAllocLabel.trim(),
          category_id: releaseFor.category_id ?? null,
          disaster_id: releaseFor.disaster_id,
          allocated_amount: amt,
          notes:
            `Automatically created during release for request from ${releaseFor.profiles?.first_name ?? ""} ${releaseFor.profiles?.last_name ?? ""}`.trim(),
          created_by: uid,
        })
        .select("id")
        .single();
      if (allocErr) return toast.error(`Failed to create allocation: ${allocErr.message}`);
      targetAllocationId = newAlloc.id;
      await logAudit("allocation.create", "fund_allocations", targetAllocationId, {
        label: inlineAllocLabel.trim(),
        allocated_amount: amt,
        disaster_id: releaseFor.disaster_id,
      });
    } else {
      targetAllocationId = releaseForm.allocation_id || null;
    }

    const { error: insErr } = await supabase.from("fund_releases").insert({
      request_id: releaseFor.id,
      allocation_id: targetAllocationId,
      amount: amt,
      reference_number: releaseForm.reference_number || null,
      notes: releaseForm.notes || null,
      released_by: uid,
      proof_url: up.data.path,
    });
    if (insErr) return toast.error(insErr.message);

    if (targetAllocationId) {
      if (createAllocationInline) {
        await supabase
          .from("fund_allocations")
          .update({ released_amount: amt })
          .eq("id", targetAllocationId);
      } else {
        const alloc = (allocs.data ?? []).find((a) => a.id === targetAllocationId);
        if (alloc) {
          await supabase
            .from("fund_allocations")
            .update({ released_amount: Number(alloc.released_amount) + amt })
            .eq("id", alloc.id);
        }
      }
    }

    // Decide whether the request is now fully fulfilled
    const { data: existingReleases } = await supabase
      .from("fund_releases")
      .select("amount")
      .eq("request_id", releaseFor.id);
    const totalReleased = (existingReleases ?? []).reduce(
      (s: number, x: any) => s + Number(x.amount),
      0,
    );
    const requested = Number(releaseFor.requested_amount ?? 0);
    const fullyFulfilled = requested > 0 && totalReleased >= requested;
    await supabase
      .from("fund_requests")
      .update({ status: fullyFulfilled ? "released" : "approved" })
      .eq("id", releaseFor.id);
    await logAudit("request.release", "fund_requests", releaseFor.id, {
      ...releaseForm,
      amount: amt,
      proof_url: up.data.path,
      fully_fulfilled: fullyFulfilled,
    });
    await notify(
      releaseFor.requester_id,
      `Funds released for your request`,
      `${formatPHP(amt)} released${fullyFulfilled ? " (request fully fulfilled)" : " (partial release)"}. Reference: ${releaseForm.reference_number || "—"}`,
      "high",
    );
    toast.success(
      fullyFulfilled
        ? "Funds released — request fully fulfilled"
        : "Partial release recorded — you can release more later",
    );
    setReleaseFor(null);
    setReleaseForm({ amount: "", allocation_id: "", reference_number: "", notes: "" });
    setReleaseProof(null);
    qc.invalidateQueries({ queryKey: ["ops-requests"] });
    qc.invalidateQueries({ queryKey: ["ops-allocations"] });
  };

  // For release modal: allocations limited to the same campaign + general
  const allocationsForRelease = useMemo(() => {
    if (!releaseFor) return [];
    const tied = (allocs.data ?? []).filter(
      (a: any) => !a.disaster_id || a.disaster_id === releaseFor.disaster_id,
    );
    return tied;
  }, [releaseFor, allocs.data]);

  return (
    <AdminShell
      title="Operations"
      subtitle="One workspace for campaigns, allocations, and aid requests. Approve, allocate, and release without page-hopping."
      actions={
        <Button variant="default" onClick={() => setEditingCampaign(blankCampaign())}>
          <Plus className="h-4 w-4" /> New campaign
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoring</TabsTrigger>
            <TabsTrigger value="closed">Closed</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative ml-auto w-full max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name or location"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Unassigned requests panel */}
      {unassignedRequests.length > 0 && (
        <div className="mb-6 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-warning-foreground" />
            <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-warning-foreground">
              Unassigned requests — need triage ({unassignedRequests.length})
            </h2>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Approving one of these will automatically open a new disaster campaign so citizens can
            donate.
          </p>
          <div className="space-y-2">
            {unassignedRequests.map((r: any) => (
              <RequestRow key={r.id} r={r} onReview={() => setReviewing(r)} compact />
            ))}
          </div>
        </div>
      )}

      {/* Campaign cards */}
      {campaigns.isLoading && <p className="text-sm text-muted-foreground">Loading campaigns…</p>}
      {!campaigns.isLoading && filteredCampaigns.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No campaigns match this view. Create one to get started.
        </div>
      )}

      <Accordion type="multiple" className="space-y-3">
        {filteredCampaigns.map((d: any) => {
          const reqs = requestsByCampaign[d.id] ?? [];
          const pendingCount = reqs.filter(
            (r) => r.status === "pending" || r.status === "under_review",
          ).length;
          const approvedCount = reqs.filter((r) => r.status === "approved").length;
          const camAllocs = allocsByCampaign[d.id] ?? [];
          const allocated = camAllocs.reduce((s, a) => s + Number(a.allocated_amount), 0);
          const released = camAllocs.reduce((s, a) => s + Number(a.released_amount), 0);
          const available = Math.max(0, allocated - released);
          const raised = Number(d.raised_amount ?? 0);
          const required = Number(d.required_funding ?? 0);
          const pct = required > 0 ? Math.min(100, Math.round((raised / required) * 100)) : 0;

          return (
            <AccordionItem
              key={d.id}
              value={d.id}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex flex-1 flex-col gap-2 pr-3 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <Siren className="h-4 w-4 text-relief" />
                    <span className="font-display text-base font-semibold">{d.name}</span>
                    <SevBadge sev={d.severity} />
                    <StatusBadge status={d.status} />
                    {pendingCount > 0 && (
                      <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-semibold text-warning-foreground">
                        {pendingCount} pending
                      </span>
                    )}
                    {approvedCount > 0 && (
                      <span className="rounded-full bg-relief/20 px-2 py-0.5 text-[10px] font-semibold text-relief">
                        {approvedCount} to release
                      </span>
                    )}
                    {d.closure_requested && d.status !== "closed" && (
                      <span
                        className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive"
                        title={d.closure_reason ?? ""}
                      >
                        Closure requested
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      {d.city}
                      {d.barangay ? ` · ${d.barangay}` : ""}
                    </span>
                    <span>Occurred {formatDate(d.occurred_at)}</span>
                    <span className="tabular-nums">
                      {formatPHP(raised)} raised of {formatPHP(required)}
                    </span>
                    <span className="tabular-nums">
                      Allocated {formatPHP(allocated)} · Available {formatPHP(available)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-gradient-to-r from-relief to-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="border-t border-border bg-paper/50 px-4 py-4">
                <Tabs defaultValue="requests">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <TabsList>
                      <TabsTrigger value="requests">Requests ({reqs.length})</TabsTrigger>
                      <TabsTrigger value="allocations">
                        Allocations ({camAllocs.length})
                      </TabsTrigger>
                      <TabsTrigger value="details">Details</TabsTrigger>
                    </TabsList>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setAllocFor(d)}>
                        <Wallet className="h-3.5 w-3.5" /> Allocate funds
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setEditingCampaign({
                            id: d.id,
                            name: d.name,
                            category_id: d.category_id,
                            description: d.description ?? "",
                            location: d.location,
                            city: d.city,
                            barangay: d.barangay ?? "",
                            severity: d.severity,
                            status: d.status,
                            affected_families: String(d.affected_families ?? ""),
                            affected_individuals: String(d.affected_individuals ?? ""),
                            required_funding: String(d.required_funding ?? ""),
                            occurred_at: String(d.occurred_at).slice(0, 10),
                          })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {d.status !== "closed" && (
                        <Button variant="ghost" size="sm" onClick={() => closeCampaign(d.id)}>
                          <X className="h-3.5 w-3.5" /> Close
                        </Button>
                      )}
                    </div>
                  </div>

                  <TabsContent value="requests" className="mt-0">
                    {reqs.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                        No requests for this campaign yet.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {reqs.map((r) => (
                          <RequestRow
                            key={r.id}
                            r={r}
                            onReview={() => setReviewing(r)}
                            onRelease={() => {
                              setReleaseFor(r);
                              setReleaseForm({
                                amount: String(r.requested_amount ?? ""),
                                allocation_id: "",
                                reference_number: "",
                                notes: "",
                              });
                              setReleaseProof(null);
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="allocations" className="mt-0">
                    {camAllocs.length === 0 ? (
                      <p className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                        No allocations yet. Use “Allocate funds” to earmark money for this campaign.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-md border border-border">
                        <table className="w-full text-sm">
                          <thead className="bg-secondary text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                            <tr>
                              <th className="px-3 py-2">Label</th>
                              <th className="px-3 py-2 text-right">Allocated</th>
                              <th className="px-3 py-2 text-right">Released</th>
                              <th className="px-3 py-2 text-right">Available</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {camAllocs.map((a) => {
                              const avail = Math.max(
                                0,
                                Number(a.allocated_amount) - Number(a.released_amount),
                              );
                              return (
                                <tr key={a.id}>
                                  <td className="px-3 py-2">
                                    <p className="font-medium">{a.label}</p>
                                    {a.notes && (
                                      <p className="text-[11px] text-muted-foreground">{a.notes}</p>
                                    )}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums">
                                    {formatPHP(a.allocated_amount)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums text-relief">
                                    {formatPHP(a.released_amount)}
                                  </td>
                                  <td className="px-3 py-2 text-right tabular-nums font-semibold">
                                    {formatPHP(avail)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="details" className="mt-0 space-y-2 text-sm">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info label="Category">{d.disaster_categories?.name ?? "—"}</Info>
                      <Info label="Severity">{d.severity}</Info>
                      <Info label="Families affected">{d.affected_families ?? 0}</Info>
                      <Info label="Individuals affected">{d.affected_individuals ?? 0}</Info>
                      <Info label="Required funding">{formatPHP(d.required_funding)}</Info>
                      <Info label="Raised">{formatPHP(d.raised_amount)}</Info>
                    </div>
                    {d.description && (
                      <div>
                        <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                          Description
                        </Label>
                        <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-paper p-3 text-sm">
                          {d.description}
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {/* ---------- Campaign editor dialog ---------- */}
      <Dialog open={!!editingCampaign} onOpenChange={(o) => !o && setEditingCampaign(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCampaign?.id ? "Edit campaign" : "Register new campaign"}
            </DialogTitle>
          </DialogHeader>
          {editingCampaign && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Campaign name *" className="sm:col-span-2">
                <Input
                  value={editingCampaign.name}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, name: e.target.value })}
                />
              </Field>
              <Field label="Category *">
                <Select
                  value={editingCampaign.category_id}
                  onValueChange={(v) => setEditingCampaign({ ...editingCampaign, category_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(cats.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Occurred on *">
                <Input
                  type="date"
                  value={editingCampaign.occurred_at}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, occurred_at: e.target.value })
                  }
                />
              </Field>
              <Field label="Severity">
                <Select
                  value={editingCampaign.severity}
                  onValueChange={(v: any) =>
                    setEditingCampaign({ ...editingCampaign, severity: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "moderate", "high", "critical"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={editingCampaign.status}
                  onValueChange={(v: any) => setEditingCampaign({ ...editingCampaign, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["active", "monitoring", "closed"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="City *">
                <Input
                  value={editingCampaign.city}
                  onChange={(e) => setEditingCampaign({ ...editingCampaign, city: e.target.value })}
                />
              </Field>
              <Field label="Barangay">
                <Input
                  value={editingCampaign.barangay}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, barangay: e.target.value })
                  }
                />
              </Field>
              <Field label="Location / address *" className="sm:col-span-2">
                <Input
                  value={editingCampaign.location}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, location: e.target.value })
                  }
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Textarea
                  rows={3}
                  value={editingCampaign.description}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, description: e.target.value })
                  }
                />
              </Field>
              <Field label="Families affected">
                <Input
                  inputMode="numeric"
                  value={editingCampaign.affected_families}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      affected_families: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                />
              </Field>
              <Field label="Individuals affected">
                <Input
                  inputMode="numeric"
                  value={editingCampaign.affected_individuals}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      affected_individuals: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                />
              </Field>
              <Field label="Required funding (₱)" className="sm:col-span-2">
                <Input
                  inputMode="decimal"
                  value={editingCampaign.required_funding}
                  onChange={(e) =>
                    setEditingCampaign({
                      ...editingCampaign,
                      required_funding: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                />
              </Field>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCampaign(null)}>
              Cancel
            </Button>
            <Button onClick={saveCampaign}>
              {editingCampaign?.id ? "Save changes" : "Create campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Allocation dialog ---------- */}
      <Dialog open={!!allocFor} onOpenChange={(o) => !o && setAllocFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Allocate funds for {allocFor?.name}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label className="text-xs">Label *</Label>
              <Input
                className="mt-1"
                value={allocForm.label}
                onChange={(e) => setAllocForm({ ...allocForm, label: e.target.value })}
                placeholder="e.g. Phase 1 relief"
              />
            </div>
            <div>
              <Label className="text-xs">Amount (₱) *</Label>
              <Input
                className="mt-1"
                inputMode="decimal"
                placeholder="0.00"
                value={allocForm.allocated_amount}
                onChange={(e) =>
                  setAllocForm({
                    ...allocForm,
                    allocated_amount: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
              />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={allocForm.notes}
                onChange={(e) => setAllocForm({ ...allocForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllocFor(null)}>
              Cancel
            </Button>
            <Button onClick={createAllocation}>Create allocation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Request review dialog ---------- */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review request</DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Requester">
                  {reviewing.profiles?.first_name} {reviewing.profiles?.last_name}
                </Info>
                <Info label="Contact">
                  {reviewing.profiles?.mobile_number} · {reviewing.profiles?.email}
                </Info>
                <Info label="Location">
                  {reviewing.exact_location}, {reviewing.barangay}, {reviewing.city}
                </Info>
                <Info label="Submitted">{formatDate(reviewing.created_at)}</Info>
                <Info label="Individuals affected">{reviewing.affected_individuals}</Info>
                <Info label="Estimated damage">{formatPHP(reviewing.estimated_damage_cost)}</Info>
                <Info label="Requested amount" highlight>
                  {formatPHP(reviewing.requested_amount)}
                </Info>
                <Info label="Status">
                  <StatusBadge status={reviewing.status} />
                </Info>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Description
                </Label>
                <p className="mt-1 whitespace-pre-wrap rounded-md border border-border bg-paper p-3 text-sm">
                  {reviewing.disaster_description}
                </p>
              </div>
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                  Reviewer notes
                </Label>
                <Textarea
                  className="mt-1"
                  rows={3}
                  defaultValue={reviewing.reviewer_notes ?? ""}
                  onBlur={(e) => setReviewing({ ...reviewing, reviewer_notes: e.target.value })}
                />
              </div>
              {!reviewing.disaster_id &&
                reviewing.status !== "released" &&
                reviewing.status !== "approved" && (
                  <div>
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                      Campaign Association
                    </Label>
                    <Select value={linkToCampaignId} onValueChange={setLinkToCampaignId}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select campaign" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_new">Create new disaster campaign (Default)</SelectItem>
                        {(campaigns.data ?? [])
                          .filter((d: any) => d.status !== "closed")
                          .map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              Link to: {c.name} ({c.city})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Link this request to an existing active campaign, or select default to create
                      a new campaign automatically.
                    </p>
                  </div>
                )}
            </div>
          )}
          <DialogFooter className="flex-wrap gap-2">
            {reviewing && (
              <div className="mr-auto flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Background:</span>
                {reviewing.verification_status === "verified" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-relief/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-relief">
                    <ShieldCheck className="h-3 w-3" /> Verified
                  </span>
                ) : (
                  <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning-foreground">
                    Unverified
                  </span>
                )}
                {reviewing.verification_status !== "verified" &&
                  reviewing.status !== "released" && (
                    <Button variant="outline" size="sm" onClick={() => verifyRequest(reviewing)}>
                      <ShieldCheck className="h-3.5 w-3.5" /> Verify
                    </Button>
                  )}
              </div>
            )}
            {reviewing && reviewing.status !== "released" && (
              <>
                {reviewing.status === "pending" && (
                  <Button
                    variant="outline"
                    onClick={() => setRequestStatus(reviewing, "under_review")}
                  >
                    Mark under review
                  </Button>
                )}
                {reviewing.status !== "rejected" && (
                  <Button
                    variant="destructive"
                    onClick={() =>
                      setRequestStatus(reviewing, "rejected", reviewing.reviewer_notes)
                    }
                  >
                    <X className="h-4 w-4" /> Reject
                  </Button>
                )}
                {reviewing.status !== "approved" && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() =>
                        setRequestStatus(reviewing, "approved", reviewing.reviewer_notes, false)
                      }
                    >
                      <Check className="mr-1 h-4 w-4 text-relief" /> Approve & Close
                    </Button>
                    <Button
                      variant="relief"
                      onClick={() =>
                        setRequestStatus(reviewing, "approved", reviewing.reviewer_notes, true)
                      }
                    >
                      <Send className="mr-1 h-4 w-4" /> Approve & Release
                    </Button>
                  </>
                )}
                {reviewing.status === "approved" && (
                  <Button
                    onClick={() => {
                      setReleaseFor(reviewing);
                      setReleaseForm({
                        amount: String(reviewing.requested_amount ?? ""),
                        allocation_id: "",
                        reference_number: "",
                        notes: "",
                      });
                      setReleaseProof(null);
                      setReviewing(null);
                    }}
                  >
                    <Send className="h-4 w-4" /> Release funds
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- Release dialog ---------- */}
      <Dialog open={!!releaseFor} onOpenChange={(o) => !o && setReleaseFor(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Release funds</DialogTitle>
          </DialogHeader>
          {releaseFor && (
            <div className="grid gap-4 text-sm">
              <p className="rounded-md bg-secondary p-3 text-xs">
                For:{" "}
                <span className="font-medium">
                  {releaseFor.profiles?.first_name} {releaseFor.profiles?.last_name}
                </span>{" "}
                · {formatPHP(releaseFor.requested_amount)} requested
              </p>
              <div>
                <Label className="text-xs">Amount to release (₱) *</Label>
                <Input
                  className="mt-1"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={releaseForm.amount}
                  onChange={(e) =>
                    setReleaseForm({
                      ...releaseForm,
                      amount: e.target.value.replace(/[^0-9.]/g, ""),
                    })
                  }
                />
              </div>
              <div>
                <Label className="text-xs">Proof of release *</Label>
                <label
                  htmlFor="release-proof"
                  className="mt-1 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-paper p-3 text-xs hover:border-primary/40"
                >
                  {releaseProof ? (
                    <>
                      <Upload className="h-4 w-4 text-relief" />
                      <span className="truncate font-medium">{releaseProof.name}</span>
                      <span className="ml-auto text-primary">Change</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Upload receipt or signed acknowledgment (JPG, PNG, PDF — max 10MB)
                      </span>
                    </>
                  )}
                </label>
                <input
                  id="release-proof"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  className="sr-only"
                  onChange={(e) => setReleaseProof(e.target.files?.[0] ?? null)}
                />
              </div>
              <div className="rounded-lg border border-border p-3 bg-secondary/20">
                <div className="flex items-center space-x-2">
                  <input
                    id="inline-alloc-checkbox"
                    type="checkbox"
                    checked={createAllocationInline}
                    onChange={(e) => setCreateAllocationInline(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-relief focus:ring-relief"
                  />
                  <label
                    htmlFor="inline-alloc-checkbox"
                    className="text-xs font-medium cursor-pointer"
                  >
                    Create a new fund allocation for this release
                  </label>
                </div>
                {createAllocationInline ? (
                  <div className="mt-3 space-y-3 pl-6 border-l-2 border-relief">
                    <div>
                      <Label className="text-xs">Allocation Label *</Label>
                      <Input
                        className="mt-1 h-8 text-xs"
                        value={inlineAllocLabel}
                        onChange={(e) => setInlineAllocLabel(e.target.value)}
                        placeholder="e.g. Earthquake Food Packs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Allocation Amount (₱) *</Label>
                      <Input
                        className="mt-1 h-8 text-xs bg-muted"
                        disabled
                        value={formatPHP(Number(releaseForm.amount) || 0)}
                        placeholder="0.00"
                      />
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Automatically matched to the release amount.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 pl-6">
                    <Label className="text-xs">Charge against allocation</Label>
                    <Select
                      value={releaseForm.allocation_id || "_none"}
                      onValueChange={(v) =>
                        setReleaseForm({ ...releaseForm, allocation_id: v === "_none" ? "" : v })
                      }
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">— General fund —</SelectItem>
                        {allocationsForRelease.map((a: any) => {
                          const avail = Math.max(
                            0,
                            Number(a.allocated_amount) - Number(a.released_amount),
                          );
                          return (
                            <SelectItem key={a.id} value={a.id}>
                              {a.label} · {formatPHP(avail)} available
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Showing allocations tied to this campaign plus general funds.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-xs">Reference number</Label>
                <Input
                  className="mt-1"
                  value={releaseForm.reference_number}
                  onChange={(e) =>
                    setReleaseForm({ ...releaseForm, reference_number: e.target.value })
                  }
                  placeholder="DV / cheque / transfer #"
                />
              </div>
              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  value={releaseForm.notes}
                  onChange={(e) => setReleaseForm({ ...releaseForm, notes: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseFor(null)}>
              Cancel
            </Button>
            <Button onClick={release}>
              <Send className="h-4 w-4" /> Confirm release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function RequestRow({
  r,
  onReview,
  onRelease,
  compact,
}: {
  r: any;
  onReview: () => void;
  onRelease?: () => void;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {r.profiles?.first_name} {r.profiles?.last_name}{" "}
          <span className="ml-1 text-xs text-muted-foreground">· {timeAgo(r.created_at)}</span>
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {r.barangay}, {r.city}{" "}
          {compact && r.disaster_categories?.name ? `· ${r.disaster_categories.name}` : ""}
        </p>
      </div>
      <div className="text-right text-xs tabular-nums">
        <div className="font-semibold">{formatPHP(r.requested_amount)}</div>
        <div className="text-muted-foreground">{r.affected_individuals} ppl</div>
      </div>
      <StatusBadge status={r.status} />
      <div className="flex gap-1">
        <Button variant="ghost" size="sm" onClick={onReview}>
          <Eye className="h-3.5 w-3.5" /> Review
        </Button>
        {r.status === "approved" && onRelease && (
          <Button variant="relief" size="sm" onClick={onRelease}>
            <Send className="h-3.5 w-3.5" /> Release
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Info({
  label,
  children,
  highlight,
}: {
  label: string;
  children: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p
        className={`mt-0.5 ${highlight ? "font-display text-lg font-semibold text-relief" : "font-medium"}`}
      >
        {children}
      </p>
    </div>
  );
}
function SevBadge({ sev }: { sev: string }) {
  const m: Record<string, string> = {
    low: "bg-secondary text-muted-foreground",
    moderate: "bg-primary/10 text-primary",
    high: "bg-warning/20 text-warning-foreground",
    critical: "bg-destructive/15 text-destructive",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m[sev]}`}
    >
      {sev}
    </span>
  );
}
function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    pending: "bg-warning/15 text-warning-foreground",
    under_review: "bg-primary/10 text-primary",
    approved: "bg-relief/15 text-relief",
    rejected: "bg-destructive/15 text-destructive",
    released: "bg-gold/20 text-ink",
    active: "bg-relief/15 text-relief",
    monitoring: "bg-warning/15 text-warning-foreground",
    closed: "bg-secondary text-muted-foreground",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m[status] ?? "bg-secondary"}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}

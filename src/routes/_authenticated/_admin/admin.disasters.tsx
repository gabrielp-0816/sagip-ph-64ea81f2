import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, logAudit } from "@/components/sagip/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, X } from "lucide-react";
import { formatPHP, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/disasters")({
  head: () => ({ meta: [{ title: "Disaster management — SAGIP Admin" }] }),
  component: ManageDisasters,
});

type DForm = {
  id?: string;
  name: string;
  category_id: string;
  description: string;
  location: string;
  city: string;
  barangay: string;
  severity: "low" | "moderate" | "high" | "critical";
  status: "active" | "monitoring" | "closed";
  affected_families: number;
  affected_individuals: number;
  required_funding: number;
  occurred_at: string;
};

const blank = (): DForm => ({
  name: "",
  category_id: "",
  description: "",
  location: "",
  city: "",
  barangay: "",
  severity: "moderate",
  status: "active",
  affected_families: 0,
  affected_individuals: 0,
  required_funding: 0,
  occurred_at: new Date().toISOString().slice(0, 10),
});

function ManageDisasters() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<DForm | null>(null);

  const cats = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("disaster_categories").select("*").order("name")).data ?? [],
  });

  const list = useQuery({
    queryKey: ["admin-disasters"],
    queryFn: async () =>
      (await supabase.from("disasters").select("*,disaster_categories(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.category_id || !editing.location || !editing.city) {
      toast.error("Please fill required fields");
      return;
    }
    const payload = {
      name: editing.name,
      category_id: editing.category_id,
      description: editing.description || null,
      location: editing.location,
      city: editing.city,
      barangay: editing.barangay || null,
      severity: editing.severity,
      status: editing.status,
      affected_families: Number(editing.affected_families) || 0,
      affected_individuals: Number(editing.affected_individuals) || 0,
      required_funding: Number(editing.required_funding) || 0,
      occurred_at: new Date(editing.occurred_at).toISOString(),
    };
    if (editing.id) {
      const { error } = await supabase.from("disasters").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      await logAudit("disaster.update", "disasters", editing.id, payload);
      toast.success("Disaster updated");
    } else {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("disasters").insert({ ...payload, created_by: u.user?.id ?? null }).select("id").single();
      if (error) return toast.error(error.message);
      await logAudit("disaster.create", "disasters", data?.id, payload);
      toast.success("Disaster created");
    }
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-disasters"] });
  };

  const close = async (id: string) => {
    if (!confirm("Close this disaster? It will no longer accept new donations or requests.")) return;
    const { error } = await supabase.from("disasters").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("disaster.close", "disasters", id);
    toast.success("Disaster closed");
    qc.invalidateQueries({ queryKey: ["admin-disasters"] });
  };

  return (
    <AdminShell
      title="Disaster management"
      subtitle="Register, update, and close disaster events the city is responding to."
      actions={
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogTrigger asChild>
            <Button variant="default" onClick={() => setEditing(blank())}><Plus className="h-4 w-4" /> New disaster</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit disaster" : "Register new disaster"}</DialogTitle></DialogHeader>
            {editing && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Event name *" className="sm:col-span-2"><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
                <Field label="Category *">
                  <Select value={editing.category_id} onValueChange={(v) => setEditing({ ...editing, category_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>{(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Occurred on *"><Input type="date" value={editing.occurred_at} onChange={(e) => setEditing({ ...editing, occurred_at: e.target.value })} /></Field>
                <Field label="Severity">
                  <Select value={editing.severity} onValueChange={(v: any) => setEditing({ ...editing, severity: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low", "moderate", "high", "critical"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Status">
                  <Select value={editing.status} onValueChange={(v: any) => setEditing({ ...editing, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["active", "monitoring", "closed"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="City *"><Input value={editing.city} onChange={(e) => setEditing({ ...editing, city: e.target.value })} /></Field>
                <Field label="Barangay"><Input value={editing.barangay} onChange={(e) => setEditing({ ...editing, barangay: e.target.value })} /></Field>
                <Field label="Location / address *" className="sm:col-span-2"><Input value={editing.location} onChange={(e) => setEditing({ ...editing, location: e.target.value })} /></Field>
                <Field label="Description" className="sm:col-span-2"><Textarea rows={3} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
                <Field label="Families affected"><Input type="number" min="0" value={editing.affected_families} onChange={(e) => setEditing({ ...editing, affected_families: Number(e.target.value) })} /></Field>
                <Field label="Individuals affected"><Input type="number" min="0" value={editing.affected_individuals} onChange={(e) => setEditing({ ...editing, affected_individuals: Number(e.target.value) })} /></Field>
                <Field label="Required funding (₱)" className="sm:col-span-2"><Input type="number" min="0" step="100" value={editing.required_funding} onChange={(e) => setEditing({ ...editing, required_funding: Number(e.target.value) })} /></Field>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={save}>{editing?.id ? "Save changes" : "Create disaster"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Severity</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Funding</th>
              <th className="px-4 py-3">Occurred</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(list.data ?? []).length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No disasters registered yet.</td></tr>}
            {(list.data ?? []).map((d: any) => (
              <tr key={d.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-muted-foreground">{d.disaster_categories?.name}</p>
                </td>
                <td className="px-4 py-3">{d.city}{d.barangay ? ` · ${d.barangay}` : ""}</td>
                <td className="px-4 py-3"><SevBadge sev={d.severity} /></td>
                <td className="px-4 py-3"><StatusBadge status={d.status} /></td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <div>{formatPHP(d.raised_amount)}</div>
                  <div className="text-xs text-muted-foreground">of {formatPHP(d.required_funding)}</div>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(d.occurred_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" onClick={() => setEditing({
                      id: d.id, name: d.name, category_id: d.category_id, description: d.description ?? "",
                      location: d.location, city: d.city, barangay: d.barangay ?? "", severity: d.severity,
                      status: d.status, affected_families: d.affected_families, affected_individuals: d.affected_individuals,
                      required_funding: Number(d.required_funding), occurred_at: String(d.occurred_at).slice(0, 10),
                    })}><Pencil className="h-3.5 w-3.5" /></Button>
                    {d.status !== "closed" && <Button variant="ghost" size="sm" onClick={() => close(d.id)}><X className="h-3.5 w-3.5" /></Button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="text-xs">{label}</Label><div className="mt-1">{children}</div></div>;
}
function SevBadge({ sev }: { sev: string }) {
  const m: Record<string, string> = { low: "bg-secondary text-muted-foreground", moderate: "bg-primary/10 text-primary", high: "bg-warning/20 text-warning-foreground", critical: "bg-destructive/15 text-destructive" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m[sev]}`}>{sev}</span>;
}
function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = { active: "bg-relief/15 text-relief", monitoring: "bg-warning/15 text-warning-foreground", closed: "bg-secondary text-muted-foreground" };
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${m[status]}`}>{status}</span>;
}

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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { formatPHP } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/allocations")({
  head: () => ({ meta: [{ title: "Fund allocations — SAGIP Admin" }] }),
  component: Allocations,
});

function Allocations() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ label: "", category_id: "", disaster_id: "", allocated_amount: 0, notes: "" });

  const cats = useQuery({ queryKey: ["categories"], queryFn: async () => (await supabase.from("disaster_categories").select("*").order("name")).data ?? [] });
  const disasters = useQuery({ queryKey: ["disaster-min"], queryFn: async () => (await supabase.from("disasters").select("id,name,status").neq("status", "closed").order("created_at", { ascending: false })).data ?? [] });
  const allocs = useQuery({
    queryKey: ["allocations"],
    queryFn: async () => (await supabase.from("fund_allocations").select("*,disaster_categories(name),disasters(name)").order("created_at", { ascending: false })).data ?? [],
  });

  const create = async () => {
    if (!form.label || form.allocated_amount <= 0) return toast.error("Provide a label and a positive amount");
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase.from("fund_allocations").insert({
      label: form.label,
      category_id: form.category_id || null,
      disaster_id: form.disaster_id || null,
      allocated_amount: form.allocated_amount,
      notes: form.notes || null,
      created_by: u.user?.id ?? null,
    }).select("id").single();
    if (error) return toast.error(error.message);
    await logAudit("allocation.create", "fund_allocations", data?.id, form);
    toast.success("Allocation created");
    setOpen(false);
    setForm({ label: "", category_id: "", disaster_id: "", allocated_amount: 0, notes: "" });
    qc.invalidateQueries({ queryKey: ["allocations"] });
  };

  const del = async (id: string) => {
    if (!confirm("Delete this allocation? Releases tied to it will be unlinked.")) return;
    const { error } = await supabase.from("fund_allocations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    await logAudit("allocation.delete", "fund_allocations", id);
    toast.success("Deleted");
    qc.invalidateQueries({ queryKey: ["allocations"] });
  };

  return (
    <AdminShell
      title="Fund allocations"
      subtitle="Earmark funds for specific disasters, categories, or general operations."
      actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New allocation</Button>}
    >
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3 text-right">Allocated</th>
              <th className="px-4 py-3 text-right">Released</th>
              <th className="px-4 py-3 text-right">Available</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(allocs.data ?? []).length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No allocations yet.</td></tr>}
            {(allocs.data ?? []).map((a: any) => {
              const avail = Math.max(0, Number(a.allocated_amount) - Number(a.released_amount));
              return (
                <tr key={a.id} className="hover:bg-secondary/50">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.label}</p>
                    {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {a.disasters?.name && <div>Disaster: <span className="font-medium">{a.disasters.name}</span></div>}
                    {a.disaster_categories?.name && <div>Category: <span className="font-medium">{a.disaster_categories.name}</span></div>}
                    {!a.disasters?.name && !a.disaster_categories?.name && <span className="text-muted-foreground">General</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPHP(a.allocated_amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-relief">{formatPHP(a.released_amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">{formatPHP(avail)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => del(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New fund allocation</DialogTitle></DialogHeader>
          <div className="grid gap-4">
            <div><Label className="text-xs">Label *</Label><Input className="mt-1" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="e.g. Typhoon Pepito relief — Phase 1" /></div>
            <div><Label className="text-xs">Amount (₱) *</Label><Input className="mt-1" type="number" min="0" step="100" value={form.allocated_amount} onChange={(e) => setForm({ ...form, allocated_amount: Number(e.target.value) })} /></div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Tie to disaster (optional)</Label>
                <Select value={form.disaster_id || "_none"} onValueChange={(v) => setForm({ ...form, disaster_id: v === "_none" ? "" : v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {(disasters.data ?? []).map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Category (optional)</Label>
                <Select value={form.category_id || "_none"} onValueChange={(v) => setForm({ ...form, category_id: v === "_none" ? "" : v })}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— None —</SelectItem>
                    {(cats.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label className="text-xs">Notes</Label><Textarea className="mt-1" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create allocation</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

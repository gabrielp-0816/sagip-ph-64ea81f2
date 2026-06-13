import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/sagip/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPHP, formatDateTime } from "@/lib/format";
import { Download, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/donations")({
  head: () => ({ meta: [{ title: "Donations — SAGIP Admin" }] }),
  component: Donations,
});

function Donations() {
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-donations"],
    queryFn: async () => (await supabase.from("donations").select("*,disasters(name)").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return q.data ?? [];
    const s = search.toLowerCase();
    return (q.data ?? []).filter((d: any) =>
      (d.donor_name ?? "").toLowerCase().includes(s) ||
      (d.donor_email ?? "").toLowerCase().includes(s) ||
      (d.reference_number ?? "").toLowerCase().includes(s) ||
      (d.disasters?.name ?? "").toLowerCase().includes(s),
    );
  }, [q.data, search]);

  const total = filtered.reduce((s, d: any) => s + Number(d.amount), 0);

  const exportCsv = () => {
    const rows = [["Date", "Donor", "Email", "Amount", "Method", "Reference", "Disaster", "Anonymous", "Message"]];
    for (const d of filtered as any[]) {
      rows.push([
        new Date(d.created_at).toISOString(),
        d.is_anonymous ? "Anonymous" : d.donor_name,
        d.donor_email ?? "",
        String(d.amount),
        d.payment_method,
        d.reference_number ?? "",
        d.disasters?.name ?? "General fund",
        d.is_anonymous ? "yes" : "no",
        (d.message ?? "").replace(/\n/g, " "),
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sagip-donations-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      title="Donations"
      subtitle="All donations received, with traceability for audit and acknowledgment."
      actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search donor, email, reference, disaster..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-2 text-sm">
          <span className="text-muted-foreground">Total shown: </span>
          <span className="font-display text-lg font-semibold text-relief tabular-nums">{formatPHP(total)}</span>
          <span className="ml-2 text-xs text-muted-foreground">({filtered.length} records)</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Donor</th>
              <th className="px-4 py-3">Disaster</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Method</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3">Received</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && <tr><td colSpan={6} className="p-10 text-center text-muted-foreground">No donations match the filter.</td></tr>}
            {filtered.map((d: any) => (
              <tr key={d.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{d.is_anonymous ? "Anonymous" : d.donor_name}</p>
                  {!d.is_anonymous && d.donor_email && <p className="text-xs text-muted-foreground">{d.donor_email}</p>}
                </td>
                <td className="px-4 py-3 text-xs">{d.disasters?.name ?? "General fund"}</td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums text-relief">{formatPHP(d.amount)}</td>
                <td className="px-4 py-3 text-xs capitalize">{d.payment_method.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-xs font-mono">{d.reference_number ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(d.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

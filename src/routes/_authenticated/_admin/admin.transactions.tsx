import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/sagip/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatPHP, formatDateTime } from "@/lib/format";
import { Download, Search, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/_admin/admin/transactions")({
  head: () => ({ meta: [{ title: "Transaction history — SAGIP Admin" }] }),
  component: Transactions,
});

type Tx = {
  id: string;
  direction: "donation" | "release";
  occurred_at: string;
  amount: number;
  category: string;
  reference: string;
  party: string | null;
  status: string;
  reference_number: string | null;
  proof_url: string | null;
};

function Transactions() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "donation" | "release">("all");

  const q = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transactions" as any)
        .select("*")
        .order("occurred_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as unknown as Tx[];
    },
  });

  const filtered = useMemo(() => {
    let rows = q.data ?? [];
    if (filter !== "all") rows = rows.filter((r) => r.direction === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter((r) =>
        (r.party ?? "").toLowerCase().includes(s) ||
        (r.reference ?? "").toLowerCase().includes(s) ||
        (r.category ?? "").toLowerCase().includes(s) ||
        (r.reference_number ?? "").toLowerCase().includes(s),
      );
    }
    return rows;
  }, [q.data, filter, search]);

  const totals = useMemo(() => {
    let inc = 0, out = 0;
    for (const r of filtered) (r.direction === "donation" ? (inc += Number(r.amount)) : (out += Number(r.amount)));
    return { inc, out, net: inc - out };
  }, [filtered]);

  const exportCsv = () => {
    const rows = [["Date", "Type", "Party", "Category", "Reference", "Amount", "Status", "Reference #"]];
    for (const r of filtered) {
      rows.push([
        new Date(r.occurred_at).toISOString(),
        r.direction,
        r.party ?? "",
        r.category,
        r.reference,
        String(r.amount),
        r.status,
        r.reference_number ?? "",
      ]);
    }
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sagip-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminShell
      title="Transaction history"
      subtitle="Unified record of all incoming donations and outgoing aid releases."
      actions={<Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4" /> Export CSV</Button>}
    >
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Kpi label="Incoming (donations)" value={formatPHP(totals.inc)} icon={ArrowDownCircle} accent="relief" />
        <Kpi label="Outgoing (releases)" value={formatPHP(totals.out)} icon={ArrowUpCircle} accent="gold" />
        <Kpi label="Net balance" value={formatPHP(totals.net)} accent={totals.net >= 0 ? "relief" : "warning"} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="donation">Incoming</TabsTrigger>
            <TabsTrigger value="release">Outgoing</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search party, category, reference..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-muted-foreground">{filtered.length} records</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Party</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Reference</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No transactions found.</td></tr>}
            {filtered.map((r) => (
              <tr key={`${r.direction}-${r.id}`} className="hover:bg-secondary/50">
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDateTime(r.occurred_at)}</td>
                <td className="px-4 py-3">
                  {r.direction === "donation" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-relief/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-relief"><ArrowDownCircle className="h-3 w-3" /> Incoming</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink"><ArrowUpCircle className="h-3 w-3" /> Outgoing</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{r.party ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{r.category}</td>
                <td className="px-4 py-3 text-xs">{r.reference}</td>
                <td className={`px-4 py-3 text-right font-semibold tabular-nums ${r.direction === "donation" ? "text-relief" : "text-ink"}`}>
                  {r.direction === "donation" ? "+" : "−"} {formatPHP(r.amount)}
                </td>
                <td className="px-4 py-3 text-xs capitalize">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function Kpi({ label, value, icon: Icon, accent }: { label: string; value: string; icon?: any; accent?: "relief" | "gold" | "warning" }) {
  const bar = accent === "relief" ? "bg-relief" : accent === "gold" ? "bg-gold" : accent === "warning" ? "bg-warning" : "bg-primary";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-border/80">
      <div className={`absolute left-0 top-0 h-full w-1 ${bar} transition-all duration-300 group-hover:w-1.5`} />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-foreground group-hover:scale-110" />}
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/sagip/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatPHP, formatDateTime } from "@/lib/format";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Download,
  Search,
  Receipt,
  HandHeart,
  FileCheck2,
  ExternalLink,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/transactions")({
  head: () => ({ meta: [{ title: "Transaction history — SAGIP" }] }),
  component: CitizenTransactions,
});

type Row = {
  id: string;
  kind: "donation" | "release";
  amount: number;
  occurred_at: string;
  reference: string;
  method: string;
  reference_number: string | null;
  status: string;
  proof_url: string | null;
};

function CitizenTransactions() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "donation" | "release">("all");

  const { data: user } = useQuery({
    queryKey: ["auth-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: Infinity,
  });
  const uid = user?.id ?? "";

  const q = useQuery({
    queryKey: ["my-transactions", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [donations, releases] = await Promise.all([
        supabase
          .from("donations")
          .select("id,amount,created_at,payment_method,reference_number,proof_url,disasters(name)")
          .eq("donor_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("fund_releases")
          .select(
            "id,amount,released_at,reference_number,proof_url,fund_requests!inner(id,requester_id,disaster_description)",
          )
          .eq("fund_requests.requester_id", uid)
          .order("released_at", { ascending: false }),
      ]);
      const rows: Row[] = [];
      for (const d of donations.data ?? []) {
        rows.push({
          id: `d-${d.id}`,
          kind: "donation",
          amount: Number(d.amount),
          occurred_at: d.created_at,
          reference: `Donation · ${(d.disasters as any)?.name ?? "General fund"}`,
          method: (d.payment_method ?? "").replace(/_/g, " "),
          reference_number: d.reference_number,
          status: "recorded",
          proof_url: d.proof_url,
        });
      }
      for (const r of releases.data ?? []) {
        const fr: any = r.fund_requests;
        rows.push({
          id: `r-${r.id}`,
          kind: "release",
          amount: Number(r.amount),
          occurred_at: r.released_at,
          reference: `Aid release · ${fr?.disaster_description ?? "Assistance request"}`,
          method: "fund release",
          reference_number: r.reference_number,
          status: "released",
          proof_url: r.proof_url,
        });
      }
      rows.sort((a, b) => +new Date(b.occurred_at) - +new Date(a.occurred_at));
      return rows;
    },
  });

  useEffect(() => {
    if (!uid) return;
    const ch = supabase
      .channel("my-tx-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "donations" }, () =>
        qc.invalidateQueries({ queryKey: ["my-transactions", uid] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "fund_releases" }, () =>
        qc.invalidateQueries({ queryKey: ["my-transactions", uid] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc, uid]);

  const filtered = useMemo(() => {
    let rows = q.data ?? [];
    if (filter !== "all") rows = rows.filter((r) => r.kind === filter);
    if (search.trim()) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(s) ||
          (r.reference_number ?? "").toLowerCase().includes(s) ||
          r.method.toLowerCase().includes(s),
      );
    }
    return rows;
  }, [q.data, filter, search]);

  const totals = useMemo(() => {
    let donated = 0,
      received = 0;
    for (const r of q.data ?? []) {
      if (r.kind === "donation") donated += r.amount;
      else received += r.amount;
    }
    return { donated, received };
  }, [q.data]);

  const openProof = async (row: Row) => {
    if (!row.proof_url) return;
    const bucket = row.kind === "donation" ? "donation-proofs" : "request-documents";
    const { data } = await supabase.storage.from(bucket).createSignedUrl(row.proof_url, 60 * 5);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  };

  const exportCsv = () => {
    const head = ["Date", "Type", "Reference", "Method", "Reference #", "Amount", "Status"];
    const lines = [
      head,
      ...filtered.map((r) => [
        new Date(r.occurred_at).toISOString(),
        r.kind,
        r.reference,
        r.method,
        r.reference_number ?? "",
        String(r.amount),
        r.status,
      ]),
    ];
    const csv = lines
      .map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `my-sagip-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashShell
      title="Transaction history"
      subtitle="Every donation you've made and every aid release you've received — with downloadable proofs."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SummaryCard
          label="Total donated"
          value={formatPHP(totals.donated)}
          icon={HandHeart}
          accent="relief"
        />
        <SummaryCard
          label="Aid received"
          value={formatPHP(totals.received)}
          icon={FileCheck2}
          accent="gold"
        />
        <SummaryCard label="Records on file" value={String((q.data ?? []).length)} icon={Receipt} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tabs value={filter} onValueChange={(v: any) => setFilter(v)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="donation">Donations</TabsTrigger>
            <TabsTrigger value="release">Aid released</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by reference or method..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Reference #</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Proof</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-muted-foreground">
                  No transactions yet.{" "}
                  <Link to="/donate" className="font-medium text-primary hover:underline">
                    Make your first donation
                  </Link>
                  .
                </td>
              </tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {formatDateTime(r.occurred_at)}
                </td>
                <td className="px-4 py-3">
                  {r.kind === "donation" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-relief/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-relief">
                      <ArrowUpCircle className="h-3 w-3" /> Donation
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink">
                      <ArrowDownCircle className="h-3 w-3" /> Aid release
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">
                  <p className="font-medium text-ink">{r.reference}</p>
                  <p className="capitalize text-muted-foreground">{r.method}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">{r.reference_number ?? "—"}</td>
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${r.kind === "donation" ? "text-relief" : "text-ink"}`}
                >
                  {r.kind === "donation" ? "−" : "+"} {formatPHP(r.amount)}
                </td>
                <td className="px-4 py-3 text-xs">
                  {r.proof_url ? (
                    <button
                      onClick={() => openProof(r)}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" /> View
                    </button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashShell>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  icon: any;
  accent?: "relief" | "gold";
}) {
  const bar = accent === "relief" ? "bg-relief" : accent === "gold" ? "bg-gold" : "bg-primary";
  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-card p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-lg hover:border-border/80">
      <div
        className={`absolute left-0 top-0 h-full w-1 ${bar} transition-all duration-300 group-hover:w-1.5`}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <Icon className="h-4 w-4 text-muted-foreground transition-all duration-300 group-hover:text-foreground group-hover:scale-110" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

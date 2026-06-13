import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/sagip/AdminShell";
import { Input } from "@/components/ui/input";
import { formatDateTime } from "@/lib/format";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/_admin/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — SAGIP Admin" }] }),
  component: Audit,
});

function Audit() {
  const [search, setSearch] = useState("");

  const q = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*,profiles!audit_logs_actor_id_fkey(first_name,last_name)").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return q.data ?? [];
    const s = search.toLowerCase();
    return (q.data ?? []).filter((r: any) =>
      r.action.toLowerCase().includes(s) ||
      (r.entity_type ?? "").toLowerCase().includes(s) ||
      (r.entity_id ?? "").toLowerCase().includes(s) ||
      `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.toLowerCase().includes(s),
    );
  }, [q.data, search]);

  return (
    <AdminShell title="Audit log" subtitle="Immutable record of every admin action across the system.">
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search action, entity, actor..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Metadata</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && <tr><td colSpan={5} className="p-10 text-center text-muted-foreground">No audit entries yet.</td></tr>}
            {filtered.map((r: any) => (
              <tr key={r.id} className="hover:bg-secondary/50 align-top">
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                <td className="px-4 py-3 text-xs">{r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : <span className="text-muted-foreground">System</span>}</td>
                <td className="px-4 py-3"><span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] text-primary">{r.action}</span></td>
                <td className="px-4 py-3 text-xs font-mono">{r.entity_type ?? "—"}{r.entity_id ? <span className="text-muted-foreground"> · {r.entity_id.slice(0, 8)}</span> : null}</td>
                <td className="px-4 py-3 text-xs">{r.metadata ? <pre className="max-w-md overflow-x-auto rounded bg-paper p-2 text-[10px]">{JSON.stringify(r.metadata, null, 0)}</pre> : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

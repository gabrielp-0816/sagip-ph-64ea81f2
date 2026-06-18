import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/sagip/AdminShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import {
  Search,
  Download,
  Eye,
  Copy,
  Check,
  History,
  Info,
  Clock
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/_admin/admin/audit")({
  head: () => ({ meta: [{ title: "Audit log — SAGIP Admin" }] }),
  beforeLoad: ({ context }) => {
    if (!(context as any).isSuperAdmin) {
      throw redirect({ to: "/admin" });
    }
  },
  component: Audit,
});

const CATEGORIES = {
  all: "All Categories",
  users: "User & Invite Management",
  disasters: "Disaster Operations",
  funds: "Assistance & Releases",
  allocations: "Fund Allocations",
};

const getActionCategory = (action: string) => {
  if (action.startsWith("user.") || action.startsWith("admin.invite")) return "users";
  if (action.startsWith("disaster.")) return "disasters";
  if (action.startsWith("request.")) return "funds";
  if (action.startsWith("allocation.")) return "allocations";
  return "other";
};

const getActionBadgeColor = (action: string) => {
  if (action.startsWith("user.suspend")) return "bg-destructive/15 text-destructive border-destructive/20";
  if (action.startsWith("user.unsuspend") || action.startsWith("user.verify")) return "bg-relief/15 text-relief border-relief/20";
  if (action.startsWith("user.")) return "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 border-yellow-500/20";
  if (action.startsWith("disaster.create")) return "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20";
  if (action.startsWith("disaster.close")) return "bg-secondary text-muted-foreground border-border";
  if (action.startsWith("disaster.")) return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20";
  if (action.startsWith("request.release")) return "bg-gold/15 text-gold border-gold/20";
  if (action.startsWith("request.reject")) return "bg-destructive/15 text-destructive border-destructive/20";
  if (action.startsWith("request.approve") || action.startsWith("request.verify")) return "bg-relief/15 text-relief border-relief/20";
  if (action.startsWith("request.")) return "bg-teal-500/10 text-teal-600 dark:text-teal-500 border-teal-500/20";
  if (action.startsWith("allocation.delete")) return "bg-destructive/15 text-destructive border-destructive/20";
  if (action.startsWith("allocation.")) return "bg-purple-500/10 text-purple-600 dark:text-purple-500 border-purple-500/20";
  return "bg-secondary text-secondary-foreground border-border";
};

function Audit() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [dateRange, setDateRange] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["admin-audit"],
    queryFn: async () => (await supabase.from("audit_logs").select("*,profiles!audit_logs_actor_id_fkey(first_name,last_name,email)").order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = useMemo(() => {
    let list = q.data ?? [];

    // Filter by Category
    if (category !== "all") {
      list = list.filter((r: any) => getActionCategory(r.action) === category);
    }

    // Filter by Date Range
    if (dateRange !== "all") {
      const now = Date.now();
      list = list.filter((r: any) => {
        const time = new Date(r.created_at).getTime();
        const diffHours = (now - time) / (1000 * 60 * 60);
        if (dateRange === "24h") return diffHours <= 24;
        if (dateRange === "7d") return diffHours <= 24 * 7;
        if (dateRange === "30d") return diffHours <= 24 * 30;
        return true;
      });
    }

    // Filter by Search Text
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter((r: any) =>
        r.action.toLowerCase().includes(s) ||
        (r.entity_type ?? "").toLowerCase().includes(s) ||
        (r.entity_id ?? "").toLowerCase().includes(s) ||
        `${r.profiles?.first_name ?? ""} ${r.profiles?.last_name ?? ""}`.toLowerCase().includes(s) ||
        (r.profiles?.email ?? "").toLowerCase().includes(s)
      );
    }

    // Sort Order
    if (sortOrder === "asc") {
      return [...list].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }

    return list;
  }, [q.data, search, category, dateRange, sortOrder]);

  const exportToCSV = () => {
    if (filtered.length === 0) {
      toast.error("No entries to export");
      return;
    }

    const headers = ["ID", "Timestamp", "Actor Name", "Actor Email", "Action", "Entity Type", "Entity ID", "Metadata Payload"];
    const rows = filtered.map((r: any) => [
      r.id,
      r.created_at,
      r.profiles ? `${r.profiles.first_name} ${r.profiles.last_name}` : "System",
      r.profiles?.email ?? "system@sagip.gov.ph",
      r.action,
      r.entity_type ?? "N/A",
      r.entity_id ?? "N/A",
      JSON.stringify(r.metadata ?? {}),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((e) =>
        e
          .map((val) => {
            const cleanVal = String(val).replace(/"/g, '""');
            return `"${cleanVal}"`;
          })
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `sagip_audit_report_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filtered.length} entries successfully`);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setDateRange("all");
    setSortOrder("desc");
  };

  const hasActiveFilters = search.trim() !== "" || category !== "all" || dateRange !== "all" || sortOrder !== "desc";

  return (
    <AdminShell
      title="Audit log"
      subtitle="Immutable record of every admin action across the system."
      actions={
        <Button onClick={exportToCSV} variant="outline" size="sm" className="gap-2 border-white/20 bg-transparent text-paper hover:bg-white/10">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      }
    >
      <div className="flex flex-col gap-4 mb-6">
        {/* Filter Controls Row */}
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 items-end">
          <div className="sm:col-span-2 relative">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Search logs</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search action, entity, actor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Action Category</label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {Object.entries(CATEGORIES).filter(([k]) => k !== "all").map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Timeframe</label>
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger>
                <SelectValue placeholder="All Time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Sort</label>
              <Button
                variant="outline"
                className="w-full justify-between"
                onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
              >
                {sortOrder === "desc" ? "Newest First" : "Oldest First"}
                <Clock className="h-4 w-4 ml-2 text-muted-foreground" />
              </Button>
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="self-end px-2.5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
                title="Clear Filters"
              >
                Clear
              </Button>
            )}
          </div>
        </div>

        {/* Counter Summary */}
        <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border pb-2">
          <div>
            Showing <strong className="text-foreground">{filtered.length}</strong> of{" "}
            <strong className="text-foreground">{q.data?.length ?? 0}</strong> audit records
          </div>
          {hasActiveFilters && (
            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
              Filtered View
            </span>
          )}
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Payload Preview</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {q.isLoading && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
                    Loading audit entries...
                  </td>
                </tr>
              )}
              {!q.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-muted-foreground">
                    No matching audit entries found.
                  </td>
                </tr>
              )}
              {filtered.map((r: any) => {
                const badgeStyle = getActionBadgeColor(r.action);
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedLog(r)}
                    className="hover:bg-secondary/40 align-top transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {formatDateTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 text-xs font-medium">
                      {r.profiles ? (
                        <div>
                          <p>{r.profiles.first_name} {r.profiles.last_name}</p>
                          <p className="text-[10px] text-muted-foreground font-normal">{r.profiles.email}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">System</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${badgeStyle}`}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {r.entity_type ? (
                        <div>
                          <span className="font-mono text-[11px] bg-muted/65 px-1 py-0.5 rounded text-foreground border border-border">
                            {r.entity_type}
                          </span>
                          {r.entity_id && (
                            <span className="text-muted-foreground block mt-1 font-mono text-[10px]">
                              {r.entity_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs truncate font-mono text-muted-foreground">
                      {r.metadata ? JSON.stringify(r.metadata) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedLog(r)}
                        className="h-7 w-7 p-0"
                      >
                        <Eye className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-display">
              <History className="h-5 w-5 text-primary" />
              Audit log entry details
            </DialogTitle>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-5 mt-2">
              {/* Core Attributes */}
              <div className="grid grid-cols-2 gap-4 rounded-xl border border-border bg-card p-4">
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Action Executed
                  </span>
                  <span className={`inline-block rounded border px-2 py-0.5 font-mono text-xs font-semibold tracking-wide mt-1 ${getActionBadgeColor(selectedLog.action)}`}>
                    {selectedLog.action}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Execution Time
                  </span>
                  <span className="text-xs font-medium block mt-1">
                    {formatDateTime(selectedLog.created_at)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Operator / Actor
                  </span>
                  <span className="text-xs font-medium block mt-1">
                    {selectedLog.profiles
                      ? `${selectedLog.profiles.first_name} ${selectedLog.profiles.last_name}`
                      : "System"}
                  </span>
                  {selectedLog.profiles?.email && (
                    <span className="text-[10px] text-muted-foreground block">
                      {selectedLog.profiles.email}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Record Identifier
                  </span>
                  <span className="text-xs font-mono block mt-1 flex items-center gap-1">
                    {selectedLog.id.slice(0, 8)}...
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 shrink-0"
                      onClick={() => handleCopy(selectedLog.id, "log-id")}
                    >
                      {copiedId === "log-id" ? (
                        <Check className="h-3 w-3 text-relief" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </Button>
                  </span>
                </div>
              </div>

              {/* Target Entity Information */}
              {selectedLog.entity_type && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    Target entity reference
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                        Table Name
                      </span>
                      <span className="text-xs font-mono font-semibold block mt-1 text-primary">
                        {selectedLog.entity_type}
                      </span>
                    </div>
                    {selectedLog.entity_id && (
                      <div>
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                          Record UUID
                        </span>
                        <span className="text-xs font-mono block mt-1 flex items-center gap-1">
                          {selectedLog.entity_id}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 shrink-0"
                            onClick={() => handleCopy(selectedLog.entity_id, "entity-id")}
                          >
                            {copiedId === "entity-id" ? (
                              <Check className="h-3 w-3 text-relief" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground" />
                            )}
                          </Button>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata Display */}
              <div className="rounded-xl border border-border bg-card p-4">
                <h4 className="text-xs font-semibold text-foreground mb-3">
                  Metadata & Parameters
                </h4>
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 ? (
                  <div className="space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Object.entries(selectedLog.metadata).map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-border bg-paper/60 p-3 text-xs">
                          <span className="font-semibold text-muted-foreground uppercase tracking-wider block text-[9px]">
                            {key.replace(/_/g, " ")}
                          </span>
                          <span className="font-mono text-foreground block mt-1.5 break-all">
                            {typeof val === "object" ? JSON.stringify(val, null, 1) : String(val)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <details className="mt-4 border border-border rounded-lg overflow-hidden bg-paper/30">
                      <summary className="bg-secondary px-3 py-2 text-xs font-semibold cursor-pointer select-none text-muted-foreground hover:text-foreground">
                        View raw JSON data
                      </summary>
                      <div className="relative">
                        <pre className="p-3 text-[10px] overflow-auto max-h-48 font-mono bg-paper/20">
                          {JSON.stringify(selectedLog.metadata, null, 2)}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2 h-6 text-[10px] gap-1 bg-card hover:bg-accent border border-border"
                          onClick={() => handleCopy(JSON.stringify(selectedLog.metadata, null, 2), "raw-json")}
                        >
                          {copiedId === "raw-json" ? (
                            <>
                              <Check className="h-3 w-3 text-relief" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3 text-muted-foreground" /> Copy
                            </>
                          )}
                        </Button>
                      </div>
                    </details>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground italic">No extra metadata payload is stored for this action.</p>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

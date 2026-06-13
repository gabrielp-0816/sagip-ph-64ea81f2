import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/sagip/DashShell";
import { Button } from "@/components/ui/button";
import { formatPHP, formatDate } from "@/lib/format";
import { FileText, Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/requests")({
  head: () => ({ meta: [{ title: "My requests — SAGIP" }] }),
  component: RequestsPage,
});

function RequestsPage() {
  const { data: requests, isLoading } = useQuery({
    queryKey: ["my-requests"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return [];
      return (
        await supabase
          .from("fund_requests")
          .select("id,disaster_description,status,requested_amount,estimated_damage_cost,affected_individuals,city,barangay,reviewer_notes,created_at,disasters(name),disaster_categories(name)")
          .eq("requester_id", uid)
          .order("created_at", { ascending: false })
      ).data ?? [];
    },
  });

  return (
    <DashShell title="My assistance requests" subtitle="Track the status of every relief request you have submitted.">
      <div className="mb-4 flex justify-end">
        <Button asChild><Link to="/request"><Plus className="h-4 w-4" /> New request</Link></Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (requests ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <FileText className="h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg font-semibold">No requests yet</p>
            <p className="text-sm text-muted-foreground">When you submit a request for disaster assistance, it will appear here.</p>
            <Button asChild className="mt-2"><Link to="/request">Submit a request</Link></Button>
          </div>
        )}
        <ul className="divide-y divide-border">
          {(requests ?? []).map((r: any) => (
            <li key={r.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{r.disaster_categories?.name}</span>
                    <span className="text-xs text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-1 font-display text-base font-semibold">{r.disasters?.name ?? "Standalone request"}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.disaster_description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{r.barangay}, {r.city} · {r.affected_individuals.toLocaleString()} individuals affected</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={r.status} />
                  <p className="mt-2 font-display text-lg font-semibold tabular-nums">{formatPHP(r.requested_amount)}</p>
                  <p className="text-xs text-muted-foreground">requested</p>
                </div>
              </div>
              {r.reviewer_notes && (
                <div className="mt-4 rounded-lg border border-border bg-paper p-3 text-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Reviewer note</p>
                  <p className="mt-1 text-sm">{r.reviewer_notes}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </DashShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-warning/15 text-warning-foreground",
    under_review: "bg-primary/10 text-primary",
    approved: "bg-relief/15 text-relief",
    rejected: "bg-destructive/15 text-destructive",
    fulfilled: "bg-gold/20 text-ink",
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${map[status] ?? "bg-secondary text-muted-foreground"}`}>
      {status.replace("_", " ")}
    </span>
  );
}

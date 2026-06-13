import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/sagip/SiteChrome";
import { formatPHP } from "@/lib/format";

const qo = queryOptions({
  queryKey: ["transparency"],
  queryFn: async () => {
    const [d, a, r] = await Promise.all([
      supabase.from("donations").select("amount,created_at"),
      supabase.from("fund_allocations").select("label,allocated_amount,released_amount,disaster_categories(name)"),
      supabase.from("fund_releases").select("amount,released_at"),
    ]);
    return { donations: d.data ?? [], allocations: a.data ?? [], releases: r.data ?? [] };
  },
});

export const Route = createFileRoute("/transparency")({
  head: () => ({ meta: [{ title: "Transparency — SAGIP" }, { name: "description", content: "Public ledger of donations, allocations, and fund releases for the city disaster risk management fund." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: () => {
    const { data } = useSuspenseQuery(qo);
    const totalD = data.donations.reduce((s, x) => s + Number(x.amount), 0);
    const totalA = data.allocations.reduce((s, x) => s + Number(x.allocated_amount), 0);
    const totalR = data.allocations.reduce((s, x) => s + Number(x.released_amount), 0);
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <section className="border-b border-border bg-paper py-12">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Public ledger</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">Transparency dashboard</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Every donation, allocation, and release — published in real time.</p>
          </div>
        </section>
        <section className="mx-auto grid max-w-7xl gap-4 px-4 py-12 sm:grid-cols-3 lg:px-8">
          <Stat label="Total donations received" value={formatPHP(totalD)} />
          <Stat label="Total funds allocated" value={formatPHP(totalA)} />
          <Stat label="Total funds released" value={formatPHP(totalR)} />
        </section>
        <section className="mx-auto max-w-7xl px-4 pb-16 lg:px-8">
          <h2 className="font-display text-2xl font-semibold">Allocations by category</h2>
          <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3 text-left">Allocation</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-right">Allocated</th><th className="px-4 py-3 text-right">Released</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.allocations.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">No allocations yet.</td></tr>}
                {data.allocations.map((a: any, i: number) => (
                  <tr key={i}><td className="px-4 py-3 font-medium">{a.label}</td><td className="px-4 py-3 text-muted-foreground">{a.disaster_categories?.name ?? "—"}</td><td className="px-4 py-3 text-right tabular-nums">{formatPHP(a.allocated_amount)}</td><td className="px-4 py-3 text-right tabular-nums">{formatPHP(a.released_amount)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  },
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

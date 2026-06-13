import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/sagip/SiteChrome";
import { formatPHP } from "@/lib/format";
import { MapPin } from "lucide-react";

const qo = queryOptions({
  queryKey: ["public-disasters"],
  queryFn: async () => {
    const { data } = await supabase.from("disasters")
      .select("id,name,city,severity,status,affected_families,required_funding,raised_amount,occurred_at,disaster_categories(name,slug)")
      .order("occurred_at", { ascending: false });
    return data ?? [];
  },
});

export const Route = createFileRoute("/disasters")({
  head: () => ({ meta: [{ title: "Disaster campaigns — SAGIP" }, { name: "description", content: "Active and recent disaster campaigns tracked by the City Government DRRM Office." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(qo),
  component: () => {
    const { data } = useSuspenseQuery(qo);
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <section className="border-b border-border bg-paper py-12">
          <div className="mx-auto max-w-7xl px-4 lg:px-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Operations registry</p>
            <h1 className="mt-2 font-display text-4xl font-semibold">Disaster campaigns under response</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">A live list of disaster campaigns the city is currently responding to, with funding progress for each.</p>
          </div>
        </section>
        <section className="mx-auto max-w-7xl px-4 py-12 lg:px-8">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3 text-left">Campaign</th><th className="px-4 py-3 text-left">Category</th><th className="px-4 py-3 text-left">Severity</th><th className="px-4 py-3 text-right">Affected</th><th className="px-4 py-3 text-right">Funding</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No disaster campaigns on record.</td></tr>}
                {data.map((d: any) => (
                  <tr key={d.id} className="hover:bg-accent/30">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{d.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{d.city}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{d.disaster_categories?.name}</td>
                    <td className="px-4 py-3 capitalize">{d.severity}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{d.affected_families.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatPHP(d.raised_amount)} / {formatPHP(d.required_funding, { compact: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Want to help? <Link to="/auth/signup" className="font-medium text-primary hover:underline">Register to donate</Link>.</p>
        </section>
        <SiteFooter />
      </div>
    );
  },
});

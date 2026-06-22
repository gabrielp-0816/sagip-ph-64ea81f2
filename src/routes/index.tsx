import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import {
  ArrowRight,
  ShieldCheck,
  Eye,
  HandHeart,
  Activity,
  FileSpreadsheet,
  BellRing,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteHeader, SiteFooter } from "@/components/sagip/SiteChrome";
import { supabase } from "@/integrations/supabase/client";
import { formatPHP } from "@/lib/format";
import heroImg from "@/assets/hero-relief.jpg";

const landingDataQO = queryOptions({
  queryKey: ["landing-stats"],
  queryFn: async () => {
    const [disastersRes, donationsRes, allocRes] = await Promise.all([
      supabase
        .from("disasters")
        .select(
          "id,name,city,severity,status,affected_families,required_funding,raised_amount,category_id,occurred_at,disaster_categories(name,slug)",
        )
        .eq("status", "active")
        .order("occurred_at", { ascending: false })
        .limit(3),
      supabase.from("donations").select("amount"),
      supabase.from("fund_allocations").select("allocated_amount,released_amount"),
    ]);
    const disasters = disastersRes.data ?? [];
    const totalDonations = (donationsRes.data ?? []).reduce((s, d) => s + Number(d.amount), 0);
    const allocations = allocRes.data ?? [];
    const totalAllocated = allocations.reduce((s, a) => s + Number(a.allocated_amount), 0);
    const totalReleased = allocations.reduce((s, a) => s + Number(a.released_amount), 0);
    return {
      disasters,
      totalDonations,
      totalAllocated,
      totalReleased,
      donationCount: donationsRes.data?.length ?? 0,
    };
  },
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SAGIP — Transparent Disaster Risk Fund Management" },
      {
        name: "description",
        content:
          "Donate, request assistance, and track Philippine city disaster relief funds in real time. Transparent, accountable, secure.",
      },
      { property: "og:title", content: "SAGIP — Transparent Disaster Risk Fund Management" },
      {
        property: "og:description",
        content:
          "Donate, request assistance, and track Philippine city disaster relief funds in real time.",
      },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(landingDataQO),
  component: Landing,
});

const severityClass: Record<string, string> = {
  low: "bg-relief/15 text-relief border-relief/30",
  moderate: "bg-warning/20 text-warning-foreground border-warning/40",
  high: "bg-destructive/15 text-destructive border-destructive/30",
  critical: "bg-destructive text-destructive-foreground border-destructive",
};

function Landing() {
  const { data } = useSuspenseQuery(landingDataQO);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* HERO */}
      <section className="relative overflow-hidden gradient-hero text-paper">
        <div className="absolute inset-0 paper-grid opacity-20" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 md:py-24 lg:grid-cols-12 lg:gap-8 lg:px-8">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-paper/25 bg-paper/10 px-3 py-1 text-xs font-medium uppercase tracking-wider text-paper/90 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              Official City Government Platform
            </div>
            <h1 className="mt-5 font-display text-4xl font-semibold leading-[1.05] text-balance md:text-6xl">
              Disaster relief funds, managed with public accountability.
            </h1>
            <p className="mt-5 max-w-2xl text-lg text-paper/80">
              SAGIP brings together donors, citizens, NGOs, and government officials on one
              transparent platform — so every peso reaches the families who need it, faster.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="hero" size="lg">
                <Link to="/auth/signup">
                  Register to donate <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="border-paper/30 bg-transparent text-paper hover:bg-paper/10 hover:text-paper"
              >
                <Link to="/disasters">View disaster campaigns</Link>
              </Button>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-paper/15 pt-6">
              <Stat
                label="Total donations"
                value={formatPHP(data.totalDonations, { compact: true })}
              />
              <Stat label="Active campaigns" value={String(data.disasters.length)} />
              <Stat
                label="Funds released"
                value={formatPHP(data.totalReleased, { compact: true })}
              />
            </dl>
          </div>
          <div className="relative lg:col-span-5">
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-paper/15 shadow-2xl">
              <img
                src={heroImg}
                alt="City government relief workers distributing supplies"
                className="h-full w-full object-cover"
                width={1600}
                height={2000}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-primary/90 via-primary/40 to-transparent p-6">
                <p className="font-display text-sm uppercase tracking-widest text-paper/80">
                  In service since 2024
                </p>
                <p className="mt-1 font-display text-2xl text-paper">
                  Every emergency. Every barangay.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <SectionHeader
          eyebrow="What SAGIP does"
          title="A single source of truth for disaster funds"
        />
        <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: HandHeart,
              title: "Public donations",
              body: "Citizens donate in Philippine Peso to specific disasters and receive official receipts.",
            },
            {
              icon: FileSpreadsheet,
              title: "Fund requests",
              body: "Affected residents, barangays, and NGOs submit assistance requests with verifiable documents.",
            },
            {
              icon: ShieldCheck,
              title: "Verified releases",
              body: "City officials review, approve, and release funds with a complete audit trail.",
            },
            {
              icon: Activity,
              title: "Real-time tracking",
              body: "Allocations, donations, and approvals update live across all dashboards.",
            },
            {
              icon: Eye,
              title: "Open transparency",
              body: "Public dashboards show how every peso is allocated and released.",
            },
            {
              icon: BellRing,
              title: "Citizen alerts",
              body: "Receive disaster alerts and updates on your requests instantly.",
            },
          ].map((f) => (
            <div key={f.title} className="bg-card p-7">
              <f.icon className="h-6 w-6 text-primary" />
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ACTIVE DISASTER CAMPAIGNS */}
      <section className="border-y border-border bg-paper py-20">
        <div className="mx-auto max-w-7xl px-4 lg:px-8">
          <div className="flex items-end justify-between gap-4">
            <SectionHeader
              eyebrow="Active operations"
              title="Disaster campaigns requiring response"
            />
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link to="/disasters">
                View all <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.disasters.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center md:col-span-2 lg:col-span-3">
                <p className="text-sm text-muted-foreground">
                  No active disaster campaigns at this time. The city remains on standby.
                </p>
              </div>
            )}
            {data.disasters.map((d: any) => {
              const pct =
                d.required_funding > 0
                  ? Math.min(100, (Number(d.raised_amount) / Number(d.required_funding)) * 100)
                  : 0;
              return (
                <article
                  key={d.id}
                  className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-[var(--shadow-elev-2)]"
                >
                  <div className="flex items-center justify-between border-b border-border px-5 py-3 text-xs">
                    <span className="font-medium uppercase tracking-wider text-muted-foreground">
                      {d.disaster_categories?.name ?? "Emergency"}
                    </span>
                    <span
                      className={`rounded-full border px-2 py-0.5 font-semibold uppercase ${severityClass[d.severity] ?? severityClass.moderate}`}
                    >
                      {d.severity}
                    </span>
                  </div>
                  <div className="flex-1 p-5">
                    <h3 className="font-display text-lg font-semibold text-foreground">{d.name}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {d.city}
                    </p>
                    <div className="mt-4 flex items-baseline justify-between text-sm">
                      <span className="text-muted-foreground">Affected families</span>
                      <span className="font-semibold tabular-nums">
                        {d.affected_families.toLocaleString()}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-baseline justify-between text-sm">
                        <span className="text-muted-foreground">Funding raised</span>
                        <span className="font-semibold tabular-nums">
                          {formatPHP(d.raised_amount)} /{" "}
                          {formatPHP(d.required_funding, { compact: true })}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full bg-relief transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* TRANSPARENCY */}
      <section className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeader
              eyebrow="Transparency & accountability"
              title="Every peso accounted for, in public view"
            />
            <p className="mt-4 text-base text-muted-foreground">
              SAGIP publishes real-time allocations, donations, and fund releases. Every approval is
              logged. Every release is traceable to a specific disaster and beneficiary.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Live donation ledger",
                "Disaster-specific allocation breakdowns",
                "Searchable audit trail of approvals",
                "Quarterly published financial reports",
              ].map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-4 w-4 text-relief" />
                  {i}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <BigStat
              label="Total donations received"
              value={formatPHP(data.totalDonations)}
              sub={`${data.donationCount.toLocaleString()} contributions`}
              accent="relief"
            />
            <BigStat
              label="Funds allocated"
              value={formatPHP(data.totalAllocated)}
              sub="across all categories"
            />
            <BigStat
              label="Funds released"
              value={formatPHP(data.totalReleased)}
              sub="to verified beneficiaries"
              accent="gold"
            />
            <BigStat
              label="Available"
              value={formatPHP(Math.max(0, data.totalAllocated - data.totalReleased))}
              sub="ready for disbursement"
            />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-primary py-16 text-primary-foreground">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-4 text-center lg:px-8">
          <h2 className="font-display text-3xl font-semibold text-balance md:text-4xl">
            Together, we respond faster.
          </h2>
          <p className="max-w-2xl text-primary-foreground/80">
            Register today to donate, report a disaster in your barangay, or request assistance for
            affected families.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild variant="hero" size="lg">
              <Link to="/auth/signup">Create an account</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-paper/30 bg-transparent text-paper hover:bg-paper/10 hover:text-paper"
            >
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="mx-auto max-w-7xl px-4 py-20 lg:px-8">
        <div className="grid gap-10 rounded-2xl border border-border bg-card p-8 md:grid-cols-3 md:p-12">
          <div className="md:col-span-1">
            <SectionHeader eyebrow="Get in touch" title="City DRRM Office" />
          </div>
          <div className="grid gap-4 text-sm md:col-span-2 md:grid-cols-2">
            <ContactItem
              label="Address"
              value="City Hall, Disaster Risk Reduction & Management Office, Philippines"
            />
            <ContactItem label="Hotline" value="(02) 8000-0000" />
            <ContactItem label="Email" value="drrm@city.gov.ph" />
            <ContactItem label="Operations" value="24 hours · 7 days a week" />
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wider text-paper/60">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-semibold text-paper tabular-nums">{value}</dd>
    </div>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      <h2 className="mt-2 font-display text-3xl font-semibold leading-tight text-foreground text-balance md:text-4xl">
        {title}
      </h2>
    </div>
  );
}

function BigStat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "relief" | "gold";
}) {
  const bar = accent === "relief" ? "bg-relief" : accent === "gold" ? "bg-gold" : "bg-primary";
  return (
    <div className="relative rounded-xl border border-border bg-card p-5">
      <div className={`absolute left-0 top-0 h-full w-1 rounded-l-xl ${bar}`} />
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

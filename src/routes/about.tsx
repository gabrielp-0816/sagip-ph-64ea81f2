import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/sagip/SiteChrome";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About SAGIP" },
      {
        name: "description",
        content: "SAGIP is the City Government's official disaster risk management fund platform.",
      },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <article className="mx-auto max-w-3xl px-4 py-16 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">About SAGIP</p>
        <h1 className="mt-2 font-display text-4xl font-semibold">
          A civic platform for disaster relief.
        </h1>
        <div className="prose prose-neutral mt-8 max-w-none text-base leading-relaxed text-foreground">
          <p>
            SAGIP — Filipino for "to save" — is the official disaster risk management fund platform
            of the City Government. It exists to make disaster relief funds visible, accessible, and
            accountable to the public it serves.
          </p>
          <p className="mt-4 text-muted-foreground">
            The platform is built in compliance with Republic Act 10121 (DRRM Act), the Data Privacy
            Act of 2012, and the city's Open Government policy. It is operated by the City DRRM
            Office in coordination with accredited NGOs and partner agencies.
          </p>
          <h2 className="mt-10 font-display text-2xl font-semibold">Our mission</h2>
          <p className="mt-2 text-muted-foreground">
            To deliver fast, transparent, and accountable disaster relief to every Filipino
            household — by uniting government, donors, and accredited responders on a single,
            auditable platform.
          </p>

          <h2 className="mt-8 font-display text-2xl font-semibold">Our vision</h2>
          <p className="mt-2 text-muted-foreground">
            A resilient Philippines where every peso donated reaches the families who need it most,
            and where citizens can see exactly how disaster funds are raised, allocated, and
            released — in real time.
          </p>

          <h2 className="mt-10 font-display text-2xl font-semibold">Our mandate</h2>
          <ul className="mt-3 list-disc space-y-1 pl-6 text-muted-foreground">
            <li>Receive and account for public donations to disaster relief operations.</li>
            <li>Process assistance requests from affected residents and barangays.</li>
            <li>Allocate and release funds with full audit trail and public reporting.</li>
            <li>Coordinate with NGOs and civil-society partners during emergencies.</li>
          </ul>
        </div>
      </article>
      <SiteFooter />
    </div>
  ),
});

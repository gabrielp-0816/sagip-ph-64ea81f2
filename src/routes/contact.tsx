import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader, SiteFooter } from "@/components/sagip/SiteChrome";
import { Phone, Mail, MapPin, Clock } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — SAGIP" },
      {
        name: "description",
        content:
          "Contact the City DRRM Office for disaster assistance, fund requests, or donations.",
      },
    ],
  }),
  component: () => (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-16 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
          Get in touch
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold">City DRRM Office</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          For emergencies, dial the city hotline. For platform questions, use the email below.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Card icon={Phone} label="Emergency hotline" value="(02) 8000-0000" />
          <Card icon={Mail} label="Email" value="drrm@city.gov.ph" />
          <Card icon={MapPin} label="Address" value="City Hall · DRRM Office, Philippines" />
          <Card icon={Clock} label="Operations" value="24 hours · 7 days a week" />
        </div>
      </section>
      <SiteFooter />
    </div>
  ),
});

function Card({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-border bg-card p-5">
      <div className="rounded-md bg-secondary p-2.5">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 font-medium">{value}</p>
      </div>
    </div>
  );
}

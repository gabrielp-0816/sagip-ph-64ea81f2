import { Link } from "@tanstack/react-router";
import { SagipLogo } from "./Logo";
import { Menu } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Home" },
  { to: "/disasters", label: "Disaster Campaigns" },
  { to: "/transparency", label: "Transparency" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-paper/85 backdrop-blur">
      <div className="gov-stripe" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-8">
        <Link to="/" className="flex items-center">
          <SagipLogo />
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to as string}
              activeOptions={{ exact: l.to === "/" }}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "text-primary bg-accent/60" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/auth/signup">Register</Link>
          </Button>
        </div>
        <button
          className="md:hidden rounded-md p-2 hover:bg-accent"
          onClick={() => setOpen(!open)}
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div
        className={cn(
          "md:hidden overflow-hidden border-t border-border/60 transition-all",
          open ? "max-h-96" : "max-h-0",
        )}
      >
        <div className="space-y-1 px-4 py-3">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to as string}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
          <div className="flex gap-2 pt-2">
            <Button asChild variant="outline" size="sm" className="flex-1">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm" className="flex-1">
              <Link to="/auth/signup">Register</Link>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border bg-primary text-primary-foreground">
      <div className="gov-stripe" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-4 lg:px-8">
        <div className="md:col-span-2">
          <SagipLogo variant="light" />
          <p className="mt-4 max-w-md text-sm text-primary-foreground/75">
            SAGIP is the official disaster risk management fund platform of the City Government,
            built for transparency, speed, and public accountability during emergencies.
          </p>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-primary-foreground/90">
            Platform
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
            <li>
              <Link to="/disasters" className="hover:text-primary-foreground">
                Active disasters
              </Link>
            </li>
            <li>
              <Link to="/transparency" className="hover:text-primary-foreground">
                Transparency reports
              </Link>
            </li>
            <li>
              <Link to="/auth/signup" className="hover:text-primary-foreground">
                Register
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wider text-primary-foreground/90">
            Government
          </h4>
          <ul className="mt-3 space-y-2 text-sm text-primary-foreground/75">
            <li>Data Privacy Act (RA 10173)</li>
            <li>Freedom of Information</li>
            <li>RA 10121 — DRRM Act</li>
            <li>City DRRM Office</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-primary-foreground/15">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-2 px-4 py-5 text-xs text-primary-foreground/60 md:flex-row md:items-center lg:px-8">
          <p>
            © {new Date().getFullYear()} City Government of the Philippines · SAGIP DRRM Fund System
          </p>
          <p>An official government website</p>
        </div>
      </div>
    </footer>
  );
}

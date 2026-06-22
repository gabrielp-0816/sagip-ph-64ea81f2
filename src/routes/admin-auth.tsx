import { createFileRoute, Outlet, Link } from "@tanstack/react-router";
import { SagipLogo } from "@/components/sagip/Logo";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/admin-auth")({
  component: () => (
    <div className="min-h-screen bg-ink text-paper">
      <div className="h-1 bg-gradient-to-r from-gold via-relief to-primary" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <SagipLogo variant="light" />
          <span className="hidden rounded-full border border-gold/40 bg-gold/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold sm:inline">
            <ShieldCheck className="mr-1 inline h-3 w-3" /> Admin Portal
          </span>
        </Link>
        <Link to="/auth" className="text-sm font-medium text-paper/70 hover:text-paper">
          Citizen sign in →
        </Link>
      </div>
      <Outlet />
    </div>
  ),
});

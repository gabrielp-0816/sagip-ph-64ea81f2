import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SagipLogo } from "@/components/sagip/Logo";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  component: () => (
    <div className="min-h-screen bg-paper">
      <div className="gov-stripe" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 lg:px-8">
        <Link to="/">
          <SagipLogo />
        </Link>
        <Link to="/" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>
      </div>
      <Outlet />
    </div>
  ),
});

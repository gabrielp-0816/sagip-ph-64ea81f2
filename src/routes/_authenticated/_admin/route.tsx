import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/_admin")({
  ssr: false,
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .in("role", ["admin", "super_admin"]);
    if (error || !data || data.length === 0) throw redirect({ to: "/dashboard" });
    const isSuperAdmin = data.some((r) => r.role === "super_admin");
    return { isAdmin: true, isSuperAdmin };
  },
  component: () => <Outlet />,
});

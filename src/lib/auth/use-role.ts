import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsSuperAdmin() {
  const q = useQuery({
    queryKey: ["is-super-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase.rpc("has_role", {
        _user_id: u.user.id,
        _role: "super_admin" as any,
      });
      return !!data;
    },
    staleTime: 60_000,
  });
  return { isSuperAdmin: !!q.data, loading: q.isLoading };
}

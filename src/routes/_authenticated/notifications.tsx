import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/sagip/DashShell";
import { Button } from "@/components/ui/button";
import { Bell, CheckCheck, AlertTriangle, Info, ShieldAlert } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications — SAGIP" }] }),
  component: NotificationsPage,
});

const ICONS: Record<string, any> = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  critical: ShieldAlert,
};

const ACCENTS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-primary",
  high: "text-warning-foreground",
  critical: "text-destructive",
};

function NotificationsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: items, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () =>
      (
        await supabase
          .from("notifications")
          .select("id,title,body,link,priority,is_read,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });

  useEffect(() => {
    const ch = supabase
      .channel("notifications-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications"] });
        queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
  };

  const markAllRead = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", auth.user.id).eq("is_read", false);
    if (error) { toast.error(error.message); return; }
    toast.success("All notifications marked as read");
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
  };

  const unreadCount = (items ?? []).filter((n) => !n.is_read).length;

  return (
    <DashShell title="Notifications" subtitle="Real-time alerts from the City DRRM Office.">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{unreadCount} unread of {items?.length ?? 0}</p>
        <Button variant="outline" size="sm" onClick={markAllRead} disabled={!unreadCount}>
          <CheckCheck className="h-4 w-4" /> Mark all as read
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {isLoading && <p className="p-10 text-center text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && (items ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Bell className="h-8 w-8 text-muted-foreground" />
            <p className="font-display text-lg font-semibold">You're all caught up</p>
            <p className="text-sm text-muted-foreground">New donations, request updates, and disaster alerts will arrive here in real time.</p>
          </div>
        )}
        <ul className="divide-y divide-border">
          {(items ?? []).map((n) => {
            const Icon = ICONS[n.priority] ?? Bell;
            const accent = ACCENTS[n.priority] ?? "text-primary";
            return (
              <li key={n.id} className={`flex gap-4 p-5 ${!n.is_read ? "bg-accent/40" : ""}`}>
                <div className={`mt-0.5 ${accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-display text-sm font-semibold">{n.title}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                  {n.body && <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>}
                  <div className="mt-2 flex items-center gap-3">
                    {n.link && <button type="button" onClick={() => { markRead(n.id); navigate({ to: n.link as any }); }} className="text-xs font-medium text-primary hover:underline">View details →</button>}
                    {!n.is_read && (
                      <button onClick={() => markRead(n.id)} className="text-xs font-medium text-muted-foreground hover:text-foreground">Mark as read</button>
                    )}
                  </div>
                </div>
                {!n.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-destructive" aria-label="Unread" />}
              </li>
            );
          })}
        </ul>
      </div>
    </DashShell>
  );
}

import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SagipLogo } from "./Logo";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  HandHeart,
  FileText,
  Bell,
  User,
  LogOut,
  Menu,
  ShieldCheck,
  Inbox,
  Receipt,
  AlertTriangle,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { timeAgo, formatDateTime } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONS: Record<string, any> = {
  low: Info,
  normal: Bell,
  high: AlertTriangle,
  critical: ShieldCheck,
};

const ACCENTS: Record<string, string> = {
  low: "text-muted-foreground",
  normal: "text-primary",
  high: "text-warning-foreground",
  critical: "text-destructive",
};

const nav = [
  { to: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/donate", label: "Donate", icon: HandHeart },
  { to: "/request", label: "Request aid", icon: FileText },
  { to: "/requests", label: "My requests", icon: Inbox },
  { to: "/transactions", label: "Transaction history", icon: Receipt },
  { to: "/profile", label: "My profile", icon: User },
] as const;

export function DashShell({ children, title, subtitle }: { children: ReactNode; title: string; subtitle?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const [selectedNotif, setSelectedNotif] = useState<any | null>(null);

  const meta = useQuery({
    queryKey: ["shell-meta"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { profile: null, unread: 0, isAdmin: false };

      const [profile, notif, adminRole] = await Promise.all([
        supabase.from("profiles").select("first_name,last_name,is_verified,avatar_url").eq("id", uid).maybeSingle(),
        supabase.from("notifications").select("id").eq("is_read", false),
        supabase.from("user_roles").select("role").eq("role", "admin").maybeSingle(),
      ]);
      return { profile: profile.data, unread: notif.data?.length ?? 0, isAdmin: !!adminRole.data };
    },
  });

  const notificationsQuery = useQuery({
    queryKey: ["shell-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,title,body,link,priority,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
    queryClient.invalidateQueries({ queryKey: ["shell-notifications"] });
  };

  const handleNotifClick = (n: any) => {
    setSelectedNotif(n);
    if (!n.is_read) {
      queryClient.setQueryData(["shell-notifications"], (old: any[] | undefined) => {
        if (!old) return old;
        return old.map((item) => (item.id === n.id ? { ...item, is_read: true } : item));
      });
      markRead(n.id);
    }
  };

  const markAllRead = async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", auth.user.id).eq("is_read", false);
    if (error) { toast.error(error.message); return; }
    toast.success("All notifications marked as read");
    queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
    queryClient.invalidateQueries({ queryKey: ["shell-notifications"] });
  };

  useEffect(() => {
    const ch = supabase
      .channel("shell-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
        queryClient.invalidateQueries({ queryKey: ["shell-notifications"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [queryClient]);

  const onSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  const name = meta.data?.profile ? `${meta.data.profile.first_name} ${meta.data.profile.last_name}` : "Citizen";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-paper">
      <div className="gov-stripe" />
      {/* Top bar */}
      <header className="sticky top-1 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md p-2 hover:bg-accent lg:hidden"
              onClick={() => setOpen(!open)}
              aria-label="Toggle navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard">
              <SagipLogo />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative text-foreground" aria-label="Notifications">
                  <Bell className="h-4 w-4" />
                  {!!meta.data?.unread && (
                    <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                      {meta.data.unread}
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-[450px] p-0" align="end">
                <div className="flex items-center justify-between border-b border-border p-3">
                  <span className="font-display text-sm font-semibold">Notifications</span>
                  {!!meta.data?.unread && (
                    <button
                      onClick={markAllRead}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>
                <div className="max-h-[350px] overflow-y-auto">
                  {notificationsQuery.isLoading && (
                    <p className="p-4 text-center text-xs text-muted-foreground">Loading...</p>
                  )}
                  {!notificationsQuery.isLoading && (notificationsQuery.data ?? []).length === 0 && (
                    <div className="flex flex-col items-center gap-2 p-6 text-center text-muted-foreground">
                      <Bell className="h-6 w-6" />
                      <p className="text-xs font-semibold">No notifications yet</p>
                    </div>
                  )}
                  {(notificationsQuery.data ?? []).map((n) => {
                    const Icon = ICONS[n.priority] ?? Bell;
                    const accent = ACCENTS[n.priority] ?? "text-primary";
                    return (
                      <DropdownMenuItem
                        key={n.id}
                        onClick={() => handleNotifClick(n)}
                        className={cn(
                          "flex items-start gap-3 border-b border-border/50 p-3 text-xs cursor-pointer focus:bg-accent/45",
                          !n.is_read && "bg-accent/20"
                        )}
                      >
                        <div className={cn("mt-0.5 shrink-0", accent)}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={cn("font-semibold text-ink", !n.is_read && "font-bold")}>{n.title}</p>
                          {n.body && <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2">{n.body}</p>}
                          <p className="mt-1 text-[10px] text-muted-foreground">{timeAgo(n.created_at)}</p>
                        </div>
                        {!n.is_read && (
                          <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
            {meta.data?.isAdmin && (
              <Button variant="outline" size="sm" asChild className="border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground">
                <Link to="/admin"><ShieldCheck className="h-4 w-4" /> Admin console</Link>
              </Button>
            )}
            <Link
              to="/profile"
              className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-1 pr-3 text-sm hover:bg-accent sm:flex"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                {initials}
              </span>
              <span className="font-medium">{name.split(" ")[0]}</span>
              {meta.data?.profile?.is_verified && <ShieldCheck className="h-3.5 w-3.5 text-relief" />}
            </Link>
            <Button variant="outline" size="sm" onClick={onSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] gap-6 px-4 py-6 lg:px-6">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card p-4 transition-transform lg:static lg:translate-x-0 lg:bg-transparent lg:p-0",
            open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
          )}
        >
          <nav className="space-y-0.5">
            {nav.map((n) => {
              const Icon = n.icon;
              const active = pathname === n.to || (n.to !== "/dashboard" && (pathname + "/").startsWith(n.to + "/"));
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}

                </Link>
              );
            })}
          </nav>
          <div className="mt-8 rounded-lg border border-border bg-paper p-4 text-xs text-muted-foreground">
            <p className="font-display text-sm font-semibold text-ink">DRRM Hotline</p>
            <p className="mt-1">For life-threatening emergencies, dial <span className="font-semibold text-ink">911</span> or call the City DRRM Operations Center at <span className="font-semibold text-ink">(02) 8888-0911</span>.</p>
          </div>
        </aside>
        {open && (
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          />
        )}

        {/* Main */}
        <main className="min-w-0 flex-1">
          <div className="mb-6">
            <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
            {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          {children}
        </main>
      </div>

      <Dialog open={!!selectedNotif} onOpenChange={(o) => !o && setSelectedNotif(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader className="border-b border-border pb-3">
            <div className="flex items-center gap-2">
              {(() => {
                if (!selectedNotif) return null;
                const Icon = ICONS[selectedNotif.priority] ?? Bell;
                const accent = ACCENTS[selectedNotif.priority] ?? "text-primary";
                return (
                  <div className={accent}>
                    <Icon className="h-5 w-5" />
                  </div>
                );
              })()}
              <DialogTitle>Alert Details</DialogTitle>
            </div>
            <DialogDescription>
              Received {selectedNotif && timeAgo(selectedNotif.created_at)}
            </DialogDescription>
          </DialogHeader>
          {selectedNotif && (
            <div className="space-y-4 py-3">
              <div>
                <h3 className="font-display text-base font-bold text-ink">{selectedNotif.title}</h3>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Timestamp: {formatDateTime(selectedNotif.created_at)}
                </p>
              </div>

              <div className="border-t border-border pt-3">
                <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{selectedNotif.body || "No details provided."}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="ghost" onClick={() => setSelectedNotif(null)}>Close</Button>
            {selectedNotif?.link && (
              <Button variant="relief" onClick={() => {
                const link = selectedNotif.link;
                setSelectedNotif(null);
                navigate({ to: link as any });
              }}>
                Go to page
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

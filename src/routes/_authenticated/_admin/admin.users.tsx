import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell, logAudit } from "@/components/sagip/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck, ShieldOff, Search, UserCog, KeyRound, Copy, Check } from "lucide-react";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { generateAdminInviteCode, listAdminInviteCodes } from "@/lib/auth/admin.functions";
import { useServerFn } from "@tanstack/react-start";
import { useIsSuperAdmin } from "@/lib/auth/use-role";

const ROLES = ["super_admin", "admin", "official", "ngo", "citizen"] as const;
const SUPER_ONLY_ROLES = new Set(["admin", "super_admin"]);

export const Route = createFileRoute("/_authenticated/_admin/admin/users")({
  head: () => ({ meta: [{ title: "Users & roles — SAGIP Admin" }] }),
  component: Users,
});

function Users() {
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(new Set());

  const profiles = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const roles = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  const rolesByUser = useMemo(() => {
    const m: Record<string, string[]> = {};
    for (const r of roles.data ?? []) (m[r.user_id] ??= []).push(r.role);
    return m;
  }, [roles.data]);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return (profiles.data ?? []).filter((p: any) =>
      !s ||
      `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) ||
      (p.email ?? "").toLowerCase().includes(s) ||
      (p.mobile_number ?? "").toLowerCase().includes(s),
    );
  }, [profiles.data, search]);

  const toggleSuspend = async (p: any) => {
    const { error } = await supabase.from("profiles").update({ is_suspended: !p.is_suspended }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logAudit(p.is_suspended ? "user.unsuspend" : "user.suspend", "profiles", p.id);
    toast.success(p.is_suspended ? "Account reactivated" : "Account suspended");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const toggleVerify = async (p: any) => {
    const { error } = await supabase.from("profiles").update({ is_verified: !p.is_verified }).eq("id", p.id);
    if (error) return toast.error(error.message);
    await logAudit(p.is_verified ? "user.unverify" : "user.verify", "profiles", p.id);
    await supabase.from("notifications").insert({
      user_id: p.id,
      title: p.is_verified ? "Your verification was revoked" : "Your account has been verified",
      body: p.is_verified ? "Please contact the DRRM office for clarification." : "Thank you. Verified citizens have priority assistance.",
      priority: p.is_verified ? "high" : "normal",
    });
    toast.success("Updated");
    qc.invalidateQueries({ queryKey: ["admin-profiles"] });
  };

  const openRoles = (p: any) => {
    setEditing(p);
    setSelectedRoles(new Set(rolesByUser[p.id] ?? ["citizen"]));
  };

  const saveRoles = async () => {
    if (!editing) return;
    const current = new Set(rolesByUser[editing.id] ?? []);
    const toAdd = [...selectedRoles].filter((r) => !current.has(r));
    const toRemove = [...current].filter((r) => !selectedRoles.has(r));
    for (const r of toAdd) {
      const { error } = await supabase.from("user_roles").insert({ user_id: editing.id, role: r as any });
      if (error) return toast.error(error.message);
    }
    for (const r of toRemove) {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", editing.id).eq("role", r as any);
      if (error) return toast.error(error.message);
    }
    await logAudit("user.roles_update", "user_roles", editing.id, { roles: [...selectedRoles] });
    toast.success("Roles updated");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-roles"] });
  };

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showCodes, setShowCodes] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [note, setNote] = useState("");

  const listCodes = useServerFn(listAdminInviteCodes);
  const genCode = useServerFn(generateAdminInviteCode);

  const codes = useQuery({
    queryKey: ["admin-invite-codes"],
    queryFn: async () => listCodes(),
    enabled: showCodes,
  });

  const onGenerate = async () => {
    setGenerating(true);
    try {
      const res = await genCode({ data: { note: note || undefined } });
      toast.success("Invite code generated");
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin-invite-codes"] });
      await logAudit("admin.invite_code_created", "admin_invite_codes", res.id, { code: res.code });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to generate code");
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <AdminShell title="Users & roles" subtitle="Verify citizens, assign roles, and manage account access.">
      <div className="mb-4 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name, email, mobile..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">City</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 && <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">No users match the filter.</td></tr>}
            {filtered.map((p: any) => (
              <tr key={p.id} className="hover:bg-secondary/50">
                <td className="px-4 py-3">
                  <p className="font-medium">{p.first_name} {p.last_name}</p>
                  <p className="text-xs text-muted-foreground">{p.id_type.replace(/_/g, " ")} · {p.id_number}</p>
                </td>
                <td className="px-4 py-3 text-xs">
                  <p>{p.email}</p>
                  <p className="text-muted-foreground">{p.mobile_number}</p>
                </td>
                <td className="px-4 py-3 text-xs">{p.city}</td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-wrap gap-1">
                    {(rolesByUser[p.id] ?? ["citizen"]).map((r) => (
                      <span key={r} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${r === "admin" ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>{r}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {p.is_suspended ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Suspended</span> : p.is_verified ? <span className="rounded-full bg-relief/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-relief">Verified</span> : <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning-foreground">Pending</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(p.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" title={p.is_verified ? "Revoke verification" : "Verify"} onClick={() => toggleVerify(p)}>
                      {p.is_verified ? <ShieldOff className="h-3.5 w-3.5 text-destructive" /> : <ShieldCheck className="h-3.5 w-3.5 text-relief" />}
                    </Button>
                    <Button variant="ghost" size="sm" title="Manage roles" onClick={() => openRoles(p)}><UserCog className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleSuspend(p)}>{p.is_suspended ? "Reactivate" : "Suspend"}</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isSuperAdmin && (
      <div className="mt-10 rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="h-4 w-4" /></span>
            <div>
              <h2 className="font-display text-lg font-semibold">Administrator invite codes</h2>
              <p className="text-xs text-muted-foreground">Super-admin only. Generate single-use codes for new admin registrations. All code usage is logged.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowCodes((s) => !s)}>{showCodes ? "Hide codes" : "Show codes"}</Button>
        </div>

        {showCodes && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label className="text-xs">Optional note (e.g., who this is for)</Label>
                <Input className="mt-1" placeholder="e.g., For new DRRM coordinator" value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button onClick={onGenerate} disabled={generating} className="shrink-0">
                {generating ? "Generating..." : "Generate new code"}
              </Button>
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Note</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {codes.data?.length === 0 && (
                    <tr><td colSpan={5} className="p-6 text-center text-xs text-muted-foreground">No invite codes yet.</td></tr>
                  )}
                  {codes.data?.map((c: any) => (
                    <tr key={c.id} className="hover:bg-secondary/30">
                      <td className="px-3 py-2 font-mono text-xs font-medium">{c.code}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{c.note || "—"}</td>
                      <td className="px-3 py-2 text-xs">
                        {c.used_at ? <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Used</span> : c.expires_at && new Date(c.expires_at) < new Date() ? <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning-foreground">Expired</span> : <span className="rounded-full bg-relief/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-relief">Active</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(c.created_at)}</td>
                      <td className="px-3 py-2">
                        {!c.used_at && (
                          <Button variant="ghost" size="sm" onClick={() => copyToClipboard(c.code, c.id)}>
                            {copiedId === c.id ? <Check className="h-3.5 w-3.5 text-relief" /> : <Copy className="h-3.5 w-3.5" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Manage roles — {editing?.first_name} {editing?.last_name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {ROLES.map((r) => (
              <label key={r} className="flex items-center gap-3 rounded-md border border-border p-3">
                <Checkbox checked={selectedRoles.has(r)} onCheckedChange={(v) => {
                  const next = new Set(selectedRoles);
                  if (v) next.add(r); else next.delete(r);
                  setSelectedRoles(next);
                }} />
                <div>
                  <p className="text-sm font-medium capitalize">{r}</p>
                  <p className="text-xs text-muted-foreground">
                    {r === "admin" && "Full access to all admin functions and audit logs."}
                    {r === "official" && "City official with elevated visibility (future)."}
                    {r === "ngo" && "Partner NGO coordinator (future)."}
                    {r === "citizen" && "Default role for residents."}
                  </p>
                </div>
              </label>
            ))}
            <p className="rounded-md bg-warning/10 p-3 text-xs text-warning-foreground">⚠ Granting admin gives full system control including releasing funds. Use sparingly.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveRoles}>Save roles</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

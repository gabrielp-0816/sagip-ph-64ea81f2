import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/sagip/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(60),
  middle_name: z.string().trim().max(60).optional().or(z.literal("")),
  last_name: z.string().trim().min(1, "Required").max(60),
  mobile_number: z.string().trim().min(7, "Enter a valid mobile number").max(20),
  residential_address: z.string().trim().min(5).max(200),
  city: z.string().trim().min(2).max(100),
  province: z.string().trim().min(2).max(100),
});

type FormVals = z.infer<typeof schema>;

const passwordSchema = z.object({
  password: z.string().min(8, "At least 8 characters").regex(/[A-Z]/, "Add an uppercase letter").regex(/[0-9]/, "Add a number"),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — SAGIP" }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("first_name,middle_name,last_name,birth_date,gender,mobile_number,email,residential_address,city,province,id_type,id_number,is_verified,is_suspended")
          .maybeSingle()
      ).data,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormVals>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name,
        middle_name: profile.middle_name ?? "",
        last_name: profile.last_name,
        mobile_number: profile.mobile_number ?? "",
        residential_address: profile.residential_address ?? "",
        city: profile.city ?? "",
        province: profile.province ?? "",
      });
    }
  }, [profile, reset]);

  const onSave = async (vals: FormVals) => {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: vals.first_name,
        middle_name: vals.middle_name || null,
        last_name: vals.last_name,
        mobile_number: vals.mobile_number,
        residential_address: vals.residential_address,
        city: vals.city,
        province: vals.province,
      })
      .eq("id", auth.user!.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Profile updated");
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
  };

  const pwForm = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const onChangePassword = async (vals: z.infer<typeof passwordSchema>) => {
    setPwSaving(true);
    const { error } = await supabase.auth.updateUser({ password: vals.password });
    setPwSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated");
    pwForm.reset();
  };

  if (isLoading || !profile) {
    return <DashShell title="My profile"><p className="text-sm text-muted-foreground">Loading…</p></DashShell>;
  }

  return (
    <DashShell title="My profile" subtitle="Keep your contact details up to date so the DRRM Office can reach you.">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit(onSave)} className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          <section>
            <h2 className="font-display text-lg font-semibold">Personal information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" className="mt-1.5" {...register("first_name")} />
                {errors.first_name && <p className="mt-1 text-xs text-destructive">{errors.first_name.message}</p>}
              </div>
              <div>
                <Label htmlFor="mn">Middle name</Label>
                <Input id="mn" className="mt-1.5" {...register("middle_name")} />
              </div>
              <div>
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" className="mt-1.5" {...register("last_name")} />
                {errors.last_name && <p className="mt-1 text-xs text-destructive">{errors.last_name.message}</p>}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Date of birth</Label>
                <Input value={profile.birth_date ?? ""} readOnly className="mt-1.5 bg-muted/40" />
                <p className="mt-1 text-xs text-muted-foreground">Contact DRRM Office to correct.</p>
              </div>
              <div>
                <Label>Gender</Label>
                <Input value={profile.gender ?? ""} readOnly className="mt-1.5 bg-muted/40 capitalize" />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Contact &amp; address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="mobile">Mobile number</Label>
                <Input id="mobile" className="mt-1.5" {...register("mobile_number")} />
                {errors.mobile_number && <p className="mt-1 text-xs text-destructive">{errors.mobile_number.message}</p>}
              </div>
              <div>
                <Label>Email</Label>
                <Input value={profile.email} readOnly className="mt-1.5 bg-muted/40" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="addr">Residential address</Label>
                <Input id="addr" className="mt-1.5" {...register("residential_address")} />
                {errors.residential_address && <p className="mt-1 text-xs text-destructive">{errors.residential_address.message}</p>}
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" className="mt-1.5" {...register("city")} />
              </div>
              <div>
                <Label htmlFor="province">Province</Label>
                <Input id="province" className="mt-1.5" {...register("province")} />
              </div>
            </div>
          </section>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </Button>
        </form>

        <aside className="space-y-4">
          <div className={`rounded-xl border p-6 text-sm ${profile.is_verified ? "border-relief/40 bg-relief/10" : "border-warning/40 bg-warning/10"}`}>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
              {profile.is_verified ? <ShieldCheck className="h-4 w-4 text-relief" /> : <ShieldAlert className="h-4 w-4 text-warning-foreground" />}
              {profile.is_verified ? "Verified citizen" : "Verification pending"}
            </div>
            <p className="mt-2 text-muted-foreground">
              {profile.is_verified
                ? "Your government-issued ID has been verified by the City DRRM Office. You can submit aid requests without restriction."
                : "Your uploaded ID is being reviewed. Verification typically completes within 1 business day."}
            </p>
            <div className="mt-3 text-xs text-muted-foreground">
              <p><span className="font-semibold text-ink">ID on file:</span> {profile.id_type ? `${profile.id_type.toUpperCase()} · ${maskId(profile.id_number ?? "")}` : "Not provided"}</p>
            </div>
          </div>

          <form onSubmit={pwForm.handleSubmit(onChangePassword)} className="space-y-3 rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <KeyRound className="h-4 w-4" /> Change password
            </div>
            <div>
              <Label htmlFor="new-pw" className="text-xs">New password</Label>
              <Input id="new-pw" type="password" className="mt-1" {...pwForm.register("password")} />
              {pwForm.formState.errors.password && <p className="mt-1 text-xs text-destructive">{pwForm.formState.errors.password.message}</p>}
            </div>
            <div>
              <Label htmlFor="confirm-pw" className="text-xs">Confirm</Label>
              <Input id="confirm-pw" type="password" className="mt-1" {...pwForm.register("confirm")} />
              {pwForm.formState.errors.confirm && <p className="mt-1 text-xs text-destructive">{pwForm.formState.errors.confirm.message}</p>}
            </div>
            <Button type="submit" variant="outline" size="sm" disabled={pwSaving} className="w-full">
              {pwSaving && <Loader2 className="h-4 w-4 animate-spin" />} Update password
            </Button>
          </form>
        </aside>
      </div>
    </DashShell>
  );
}

function maskId(id: string) {
  if (id.length <= 4) return "•".repeat(id.length);
  return "•".repeat(Math.max(0, id.length - 4)) + id.slice(-4);
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/sagip/DashShell";
import { AdminShell } from "@/components/sagip/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PH_PROVINCES, PH_PROVINCES_CITIES } from "@/lib/ph-locations";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldAlert, KeyRound } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(60),
  middle_name: z.string().trim().max(60).optional().or(z.literal("")),
  last_name: z.string().trim().min(1, "Required").max(60),
  mobile_number: z.string().trim().min(7, "Enter a valid mobile number").max(20),
  country: z.literal("PH").default("PH"),
  street: z.string().trim().min(2, "Required").max(200),
  city: z.string().min(2, "Required").max(80),
  province: z.string().min(2, "Required").max(80),
  postal_code: z
    .string()
    .trim()
    .regex(/^\d{4}$/, "PH postal code must be 4 digits"),
});

type FormVals = z.infer<typeof schema>;

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "At least 8 characters")
      .regex(/[A-Z]/, "Must contain an uppercase letter")
      .regex(/[a-z]/, "Must contain a lowercase letter")
      .regex(/[0-9]/, "Must contain a number")
      .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
    confirm: z.string().min(1, "Confirm password is required"),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Passwords do not match",
  });

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile — SAGIP" }] }),
  component: ProfilePage,
});

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "None", color: "bg-muted" };
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score, label: "Weak", color: "bg-destructive" };
  if (score === 3) return { score, label: "Fair", color: "bg-orange-500" };
  if (score === 4) return { score, label: "Strong", color: "bg-yellow-500" };
  return { score, label: "Very Strong", color: "bg-relief" };
}

function PasswordStrengthMeter({ password }: { password: string }) {
  const { score, label, color } = getPasswordStrength(password);
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Password strength:</span>
        <span
          className={cn(
            "font-semibold",
            score <= 2
              ? "text-destructive"
              : score === 3
                ? "text-orange-500"
                : score === 4
                  ? "text-yellow-600"
                  : "text-relief",
          )}
        >
          {label}
        </span>
      </div>
      <div className="grid grid-cols-4 gap-1.5 h-1.5">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            score >= 1 ? color : "bg-muted",
          )}
        />
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            score >= 3 ? color : "bg-muted",
          )}
        />
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            score >= 4 ? color : "bg-muted",
          )}
        />
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300",
            score >= 5 ? color : "bg-muted",
          )}
        />
      </div>
    </div>
  );
}

function ProfilePage() {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const { data: profileData, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const [profileResult, rolesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "first_name,middle_name,last_name,birth_date,gender,mobile_number,email,residential_address,street,city,province,postal_code,country,is_verified,is_suspended,id_type,id_number,id_document_path",
          )
          .eq("id", u.user.id)
          .maybeSingle(),
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", u.user.id)
          .in("role", ["admin", "super_admin"]),
      ]);

      const profile = profileResult.data;
      const isAdmin = !!rolesResult.data && rolesResult.data.length > 0;

      let inviteCode: string | null = null;
      if (isAdmin) {
        const { data: invite } = await supabase
          .from("admin_invite_codes")
          .select("code")
          .eq("used_by", u.user.id)
          .maybeSingle();
        if (invite) {
          inviteCode = invite.code;
        }
      }

      let idDocumentUrl: string | null = null;
      if (profile?.id_document_path) {
        const { data: signedData } = await supabase.storage
          .from("verification-ids")
          .createSignedUrl(profile.id_document_path, 60 * 60);
        if (signedData?.signedUrl) {
          idDocumentUrl = signedData.signedUrl;
        }
      }

      return {
        profile,
        isAdmin,
        inviteCode,
        idDocumentUrl,
      };
    },
  });

  const profile = profileData?.profile;
  const isAdmin = profileData?.isAdmin;
  const inviteCode = profileData?.inviteCode;
  const idDocumentUrl = profileData?.idDocumentUrl;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
  });

  const province = watch("province");

  useEffect(() => {
    if (profile) {
      reset({
        first_name: profile.first_name,
        middle_name: profile.middle_name ?? "",
        last_name: profile.last_name,
        mobile_number: profile.mobile_number ?? "",
        street: profile.street ?? "",
        city: profile.city ?? "",
        province: profile.province ?? "",
        postal_code: profile.postal_code ?? "",
        country: "PH",
      });
    }
  }, [profile, reset]);

  const onSave = async (vals: FormVals) => {
    setSaving(true);
    const { data: auth } = await supabase.auth.getUser();
    const fullAddress = `${vals.street}, ${vals.city}, ${vals.province} ${vals.postal_code}, ${vals.country}`;
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: vals.first_name,
        middle_name: vals.middle_name || null,
        last_name: vals.last_name,
        mobile_number: vals.mobile_number,
        residential_address: fullAddress,
        street: vals.street,
        city: vals.city,
        province: vals.province,
        postal_code: vals.postal_code,
        country: "PH",
      })
      .eq("id", auth.user!.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    queryClient.invalidateQueries({ queryKey: ["shell-meta"] });
    queryClient.invalidateQueries({ queryKey: ["admin-shell-meta"] });
  };

  const pwForm = useForm<z.infer<typeof passwordSchema>>({ resolver: zodResolver(passwordSchema) });
  const pw = pwForm.watch("password") ?? "";

  const onChangePassword = async (vals: z.infer<typeof passwordSchema>) => {
    setPwSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Not logged in");

      // Verify password is not reused
      const { data: isReused, error: checkErr } = await supabase.rpc("check_password_reuse", {
        _user_id: userId,
        _password: vals.password,
      });

      if (checkErr) throw new Error(checkErr.message);
      if (isReused) {
        toast.error(
          "You cannot reuse any of your last 5 passwords or enter your current password as new.",
        );
        setPwSaving(false);
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: vals.password });
      if (error) throw error;

      toast.success("Password updated");
      pwForm.reset();
    } catch (err) {
      toast.error((err as Error | null)?.message ?? "Failed to update password");
    } finally {
      setPwSaving(false);
    }
  };

  const Shell = isAdmin ? AdminShell : DashShell;

  if (isLoading || !profile) {
    return (
      <Shell title="My profile">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell
      title="My profile"
      subtitle="Keep your contact details up to date so the DRRM Office can reach you."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <form
          onSubmit={handleSubmit(onSave)}
          className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8"
        >
          <section>
            <h2 className="font-display text-lg font-semibold">Personal information</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="fn">First name</Label>
                <Input id="fn" className="mt-1.5" {...register("first_name")} />
                {errors.first_name && (
                  <p className="mt-1 text-xs text-destructive">{errors.first_name.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="mn">Middle name</Label>
                <Input id="mn" className="mt-1.5" {...register("middle_name")} />
              </div>
              <div>
                <Label htmlFor="ln">Last name</Label>
                <Input id="ln" className="mt-1.5" {...register("last_name")} />
                {errors.last_name && (
                  <p className="mt-1 text-xs text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Date of birth</Label>
                <Input value={profile.birth_date ?? ""} readOnly className="mt-1.5 bg-muted/40" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Contact DRRM Office to correct.
                </p>
              </div>
              <div>
                <Label>Gender</Label>
                <Input
                  value={profile.gender ?? ""}
                  readOnly
                  className="mt-1.5 bg-muted/40 capitalize"
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Contact &amp; address</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="mobile">Mobile number</Label>
                <Input id="mobile" className="mt-1.5" {...register("mobile_number")} />
                {errors.mobile_number && (
                  <p className="mt-1 text-xs text-destructive">{errors.mobile_number.message}</p>
                )}
              </div>
              <div>
                <Label>Email</Label>
                <Input value={profile.email} readOnly className="mt-1.5 bg-muted/40" />
              </div>

              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="country">Country</Label>
                  <Input id="country" className="mt-1.5 bg-muted/40" value="Philippines" readOnly />
                </div>
                <div>
                  <Label htmlFor="street">Street Address</Label>
                  <Input
                    id="street"
                    className="mt-1.5"
                    {...register("street")}
                    placeholder="House #, street, subdivision"
                  />
                  {errors.street && (
                    <p className="mt-1 text-xs text-destructive">{errors.street.message}</p>
                  )}
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-4 sm:grid-cols-3">
                <div>
                  <Label htmlFor="province">Province</Label>
                  <Select
                    value={watch("province") ?? ""}
                    onValueChange={(v) => {
                      setValue("province", v, { shouldValidate: true });
                      setValue("city", "" as FormVals["city"]);
                    }}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue placeholder="Select province" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {PH_PROVINCES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.province && (
                    <p className="mt-1 text-xs text-destructive">{errors.province.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="city">City / Municipality</Label>
                  <Select
                    value={watch("city") ?? ""}
                    onValueChange={(v) => setValue("city", v, { shouldValidate: true })}
                    disabled={!watch("province")}
                  >
                    <SelectTrigger className="mt-1.5">
                      <SelectValue
                        placeholder={
                          watch("province") ? "Select city/municipality" : "Select province first"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(PH_PROVINCES_CITIES[watch("province") ?? ""] ?? [])
                        .slice()
                        .sort()
                        .map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {errors.city && (
                    <p className="mt-1 text-xs text-destructive">{errors.city.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="postal_code">Postal Code</Label>
                  <Input
                    id="postal_code"
                    className="mt-1.5"
                    {...register("postal_code")}
                    placeholder="4-digit postal code"
                  />
                  {errors.postal_code && (
                    <p className="mt-1 text-xs text-destructive">{errors.postal_code.message}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Identity &amp; verification</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>ID type</Label>
                <Input
                  value={
                    profile.id_type
                      ? profile.id_type === "national_id"
                        ? "National ID (PhilSys)"
                        : profile.id_type === "drivers_license"
                          ? "Driver's License"
                          : profile.id_type === "passport"
                            ? "Passport"
                            : profile.id_type === "umid"
                              ? "UMID"
                              : profile.id_type === "postal_id"
                                ? "Postal ID"
                                : profile.id_type === "voters_id"
                                  ? "Voter's ID"
                                  : profile.id_type.replace(/_/g, " ")
                      : "—"
                  }
                  readOnly
                  className="mt-1.5 bg-muted/40 capitalize"
                />
              </div>
              <div>
                <Label>ID number</Label>
                <Input
                  value={profile.id_number ?? "—"}
                  readOnly
                  className="mt-1.5 bg-muted/40 font-mono"
                />
              </div>
            </div>

            {profile.id_document_path && (
              <div className="mt-4">
                <Label>Uploaded ID document</Label>
                <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-border bg-muted/10 p-3">
                  <div className="flex-1 truncate text-sm">
                    <span className="font-medium text-ink">ID Document File</span>
                    <p className="truncate text-xs text-muted-foreground">
                      {profile.id_document_path.split("/").pop()}
                    </p>
                  </div>
                  {idDocumentUrl ? (
                    <a
                      href={idDocumentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 text-xs font-medium text-primary shadow-sm hover:bg-accent hover:text-accent-foreground"
                    >
                      View ID Document
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Loading...</span>
                  )}
                </div>
              </div>
            )}

            {isAdmin && inviteCode && (
              <div className="mt-4">
                <Label>Used administrator invite code</Label>
                <Input
                  value={inviteCode}
                  readOnly
                  className="mt-1.5 bg-muted/40 font-mono uppercase"
                />
              </div>
            )}
          </section>

          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save changes
          </Button>
        </form>

        <aside className="space-y-4">
          <div
            className={`rounded-xl border p-6 text-sm ${profile.is_verified ? "border-relief/40 bg-relief/10" : "border-warning/40 bg-warning/10"}`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest">
              {profile.is_verified ? (
                <ShieldCheck className="h-4 w-4 text-relief" />
              ) : (
                <ShieldAlert className="h-4 w-4 text-warning-foreground" />
              )}
              {profile.is_verified ? "Verified citizen" : "Verification pending"}
            </div>
            <p className="mt-2 text-muted-foreground">
              {profile.is_verified
                ? "Your government-issued ID has been verified by the City DRRM Office. You can submit aid requests without restriction."
                : "Your uploaded ID is being reviewed. Verification typically completes within 1 business day."}
            </p>
            <div className="mt-3 text-xs text-muted-foreground">
              <p>
                <span className="font-semibold text-ink">ID on file:</span>{" "}
                {profile.id_type
                  ? `${profile.id_type.toUpperCase()} · ${maskId(profile.id_number ?? "")}`
                  : "Not provided"}
              </p>
            </div>
          </div>

          <form
            onSubmit={pwForm.handleSubmit(onChangePassword)}
            className="space-y-3 rounded-xl border border-border bg-card p-6"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <KeyRound className="h-4 w-4" /> Change password
            </div>
            <div>
              <Label htmlFor="new-pw" className="text-xs">
                New password
              </Label>
              <Input
                id="new-pw"
                type="password"
                className="mt-1"
                {...pwForm.register("password")}
              />
              {pwForm.formState.errors.password && (
                <p className="mt-1 text-xs text-destructive">
                  {pwForm.formState.errors.password.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="confirm-pw" className="text-xs">
                Confirm
              </Label>
              <Input
                id="confirm-pw"
                type="password"
                className="mt-1"
                {...pwForm.register("confirm", { onBlur: () => pwForm.trigger("confirm") })}
              />
              {pwForm.formState.errors.confirm && (
                <p className="mt-1 text-xs text-destructive">
                  {pwForm.formState.errors.confirm.message}
                </p>
              )}
            </div>
            <PasswordStrengthMeter password={pw} />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              disabled={pwSaving}
              className="w-full mt-2"
            >
              {pwSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Update password
            </Button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}

function maskId(id: string) {
  if (id.length <= 4) return "•".repeat(id.length);
  return "•".repeat(Math.max(0, id.length - 4)) + id.slice(-4);
}

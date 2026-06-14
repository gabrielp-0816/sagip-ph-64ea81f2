import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signUpCitizen } from "@/lib/auth/citizen.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const passwordRules = z.string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(80),
  middleName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().min(1, "Required").max(80),
  birthDate: z.string().refine((v) => {
    if (!v) return false;
    const d = new Date(v); const today = new Date();
    const age = (today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age < 120;
  }, "You must be at least 18 years old"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  mobile: z.string().regex(/^(\+?63|0)?9\d{9}$/, "Use a valid PH mobile (09XXXXXXXXX)"),
  email: z.string().email().refine((v) => {
    // Stricter than zod's default: disallow leading/trailing punctuation in local part and "..".
    if (v.includes("..")) return false;
    const at = v.indexOf("@");
    if (at < 1) return false;
    const local = v.slice(0, at);
    if (/^[.\-_]/.test(local) || /[.\-_]$/.test(local)) return false;
    const domain = v.slice(at + 1);
    return /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(domain);
  }, "Enter a valid email address"),
  address: z.string().min(5, "Required").max(200),
  city: z.string().min(2).max(80),
  province: z.string().min(2).max(80),
  idType: z.enum(["national_id", "drivers_license", "passport", "umid", "postal_id", "voters_id"]),
  idNumber: z.string().min(3).max(50),
  password: passwordRules,
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormVals = z.infer<typeof schema>;

export const Route = createFileRoute("/auth/signup")({
  head: () => ({ meta: [{ title: "Register — SAGIP" }, { name: "description", content: "Create your SAGIP account. Required: valid government ID and 18+ years of age." }] }),
  component: SignupPage,
});

function calcAge(birth: string) {
  if (!birth) return "";
  const d = new Date(birth); if (isNaN(d.getTime())) return "";
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a >= 0 ? String(a) : "";
}

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormVals>({ resolver: zodResolver(schema), defaultValues: { gender: undefined as any, idType: undefined as any } });

  const birthDate = watch("birthDate");
  const age = calcAge(birthDate);
  const pw = watch("password") ?? "";

  const onSubmit = async (vals: FormVals) => {
    if (!idFile) { toast.error("Please upload your government-issued ID"); return; }
    if (idFile.size > 5 * 1024 * 1024) { toast.error("ID file must be 5MB or smaller"); return; }
    setLoading(true);
    try {
      const idFileBase64 = await fileToBase64(idFile);
      await signUpCitizen({
        data: {
          email: vals.email,
          password: vals.password,
          firstName: vals.firstName,
          middleName: vals.middleName || null,
          lastName: vals.lastName,
          birthDate: vals.birthDate,
          gender: vals.gender,
          mobile: vals.mobile,
          address: vals.address,
          city: vals.city,
          province: vals.province,
          idType: vals.idType,
          idNumber: vals.idNumber,
          idFileName: idFile.name,
          idFileMime: idFile.type || "application/octet-stream",
          idFileBase64,
        },
      });

      // Sign in immediately
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: vals.email,
        password: vals.password,
      });
      if (signInErr) {
        toast.success("Account created. Please sign in.");
        navigate({ to: "/auth" });
        return;
      }

      toast.success("Welcome to SAGIP");
      await router.invalidate();
      navigate({ to: "/dashboard" });
    } catch (e: any) {
      toast.error(e?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Create your SAGIP account</h1>
      <p className="mt-1 text-sm text-muted-foreground">All applicants must be 18 years or older and provide a valid government-issued ID.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-8">
        <Fieldset title="Personal information">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="First name" error={errors.firstName?.message}><Input {...register("firstName")} /></Field>
            <Field label="Middle name" optional><Input {...register("middleName")} /></Field>
            <Field label="Last name" error={errors.lastName?.message}><Input {...register("lastName")} /></Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Birth date" error={errors.birthDate?.message}><Input type="date" {...register("birthDate")} max={new Date().toISOString().slice(0,10)} /></Field>
            <Field label="Age"><Input value={age} readOnly disabled placeholder="—" /></Field>
            <Field label="Gender" error={errors.gender?.message}>
              <Select onValueChange={(v: any) => setValue("gender", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                  <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mobile number" error={errors.mobile?.message}><Input placeholder="09XXXXXXXXX" {...register("mobile")} /></Field>
            <Field label="Email address" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
          </div>
          <Field label="Residential address" error={errors.address?.message}><Input {...register("address")} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" error={errors.city?.message}><Input {...register("city")} /></Field>
            <Field label="Province" error={errors.province?.message}><Input {...register("province")} /></Field>
          </div>
        </Fieldset>

        <Fieldset title="Identity verification" description="Upload a clear photo of one valid government ID. You must be 18+ to register.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="ID type" error={errors.idType?.message}>
              <Select onValueChange={(v: any) => setValue("idType", v, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Select an ID" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="national_id">National ID (PhilSys)</SelectItem>
                  <SelectItem value="drivers_license">Driver's License</SelectItem>
                  <SelectItem value="passport">Passport</SelectItem>
                  <SelectItem value="umid">UMID</SelectItem>
                  <SelectItem value="postal_id">Postal ID</SelectItem>
                  <SelectItem value="voters_id">Voter's ID</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="ID number" error={errors.idNumber?.message}><Input {...register("idNumber")} /></Field>
          </div>
          <Label className="block">ID document</Label>
          <label className="flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-paper px-4 py-8 text-sm text-muted-foreground hover:border-primary hover:bg-accent">
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
            {idFile ? (<><CheckCircle2 className="h-5 w-5 text-relief" /><span className="font-medium text-foreground">{idFile.name}</span></>) : (<><Upload className="h-5 w-5" /> Click to upload (JPG, PNG, PDF)</>)}
          </label>
        </Fieldset>

        <Fieldset title="Password" description="Minimum 8 characters with uppercase, lowercase, number, and special character.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" error={errors.password?.message}><Input type="password" {...register("password")} /></Field>
            <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" {...register("confirm")} /></Field>
          </div>
          <PasswordChecklist password={pw} />
        </Fieldset>

        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <p className="text-xs text-muted-foreground">By registering, you agree to the City Government's Data Privacy Act compliance.</p>
          <Button type="submit" size="lg" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
          </Button>
        </div>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}

function Fieldset({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, error, optional, children }: { label: string; error?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm">{label}{optional && <span className="ml-1 text-xs font-normal text-muted-foreground">(optional)</span>}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PasswordChecklist({ password }: { password: string }) {
  const checks = [
    { ok: password.length >= 8, label: "At least 8 characters" },
    { ok: /[A-Z]/.test(password), label: "One uppercase letter" },
    { ok: /[a-z]/.test(password), label: "One lowercase letter" },
    { ok: /[0-9]/.test(password), label: "One number" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "One special character" },
  ];
  return (
    <ul className="grid gap-1.5 text-xs sm:grid-cols-2">
      {checks.map((c) => (
        <li key={c.label} className={c.ok ? "text-relief" : "text-muted-foreground"}>
          {c.ok ? "✓" : "○"} {c.label}
        </li>
      ))}
    </ul>
  );
}

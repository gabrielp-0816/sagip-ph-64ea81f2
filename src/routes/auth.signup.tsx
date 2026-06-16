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
import { TermsDialog } from "@/components/sagip/TermsDialog";
import { PH_PROVINCES, PH_PROVINCES_CITIES } from "@/lib/ph-locations";
import { toast } from "sonner";
import { Loader2, Upload, CheckCircle2, ArrowLeft, ArrowRight, Check, AlertTriangle } from "lucide-react";

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
    const d = new Date(v); if (isNaN(d.getTime())) return false;
    const today = new Date();
    const age = (today.getTime() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
    return age >= 18 && age <= 120;
  }, "Age must be between 18 and 120 years"),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  mobile: z.string().regex(/^(\+?63|0)?9\d{9}$/, "Use a valid PH mobile (09XXXXXXXXX)"),
  email: z.string().email().refine((v) => {
    if (v.includes("..")) return false;
    const at = v.indexOf("@");
    if (at < 1) return false;
    const local = v.slice(0, at);
    if (/^[.\-_]/.test(local) || /[.\-_]$/.test(local)) return false;
    const domain = v.slice(at + 1);
    return /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/.test(domain);
  }, "Enter a valid email address"),
  address: z.string().min(5, "Required").max(200),
  city: z.string().min(2, "Required").max(80),
  province: z.string().min(2, "Required").max(80),
  idType: z.enum(["national_id", "drivers_license", "passport", "umid", "postal_id", "voters_id"]),
  idNumber: z.string()
    .min(3, "Required")
    .max(50)
    .regex(/^[0-9-]+$/, "ID number may contain digits and dashes only"),
  password: passwordRules,
  confirm: z.string().min(1, "Please confirm your password"),
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms and Conditions" }) }),
  acceptPrivacy: z.literal(true, { errorMap: () => ({ message: "Consent to data processing is required under RA 10173" }) }),
}).superRefine((d, ctx) => {
  if (!d.confirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirm"], message: "Please confirm your password" });
  } else if (d.password !== d.confirm) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirm"], message: "Passwords do not match" });
  }
});

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

const STEPS = [
  { key: "personal", label: "Personal Information" },
  { key: "identity", label: "Identity Verification" },
  { key: "password", label: "Password" },
  { key: "consent", label: "Consent & Agreements" },
] as const;

const STEP_FIELDS: Record<number, (keyof FormVals)[]> = {
  0: ["firstName", "middleName", "lastName", "birthDate", "gender", "mobile", "email", "address", "city", "province"],
  1: ["idType", "idNumber"],
  2: ["password", "confirm"],
  3: ["acceptTerms", "acceptPrivacy"],
};

function SignupPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const { register, handleSubmit, watch, setValue, trigger, formState: { errors } } = useForm<FormVals>({ resolver: zodResolver(schema), defaultValues: { gender: undefined as any, idType: undefined as any, acceptTerms: false as any, acceptPrivacy: false as any } });

  const birthDate = watch("birthDate");
  const age = calcAge(birthDate);
  const pw = watch("password") ?? "";

  const next = async () => {
    const fields = STEP_FIELDS[step];
    const ok = await trigger(fields as any);
    if (!ok) return;
    if (step === 1 && !idFile) { toast.error("Please upload your government-issued ID"); return; }
    if (step === 1 && idFile && idFile.size > 5 * 1024 * 1024) { toast.error("ID file must be 5MB or smaller"); return; }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async (vals: FormVals) => {
    if (!idFile) { toast.error("Please upload your government-issued ID"); setStep(1); return; }
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

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <h1 className="font-display text-3xl font-semibold">Create your SAGIP account</h1>
      <p className="mt-1 text-sm text-muted-foreground">All applicants must be 18 years or older and provide a valid government-issued ID.</p>

      <Stepper step={step} />

      <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
        {step === 0 && (
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
                <Select onValueChange={(v: any) => setValue("gender", v, { shouldValidate: true })} value={watch("gender") ?? ""}>
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
            {age !== "" && Number(age) > 120 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>The age you entered exceeds 120 years. Please verify your birth date — registration is limited to ages 18–120.</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Mobile number" error={errors.mobile?.message}><Input placeholder="09XXXXXXXXX" {...register("mobile")} /></Field>
              <Field label="Email address" error={errors.email?.message}><Input type="email" {...register("email")} /></Field>
            </div>
            <Field label="Residential address" error={errors.address?.message}><Input {...register("address")} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Province" error={errors.province?.message}>
                <Select
                  value={watch("province") ?? ""}
                  onValueChange={(v) => { setValue("province", v, { shouldValidate: true }); setValue("city", "" as any); }}
                >
                  <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {PH_PROVINCES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="City / Municipality" error={errors.city?.message}>
                <Select
                  value={watch("city") ?? ""}
                  onValueChange={(v) => setValue("city", v, { shouldValidate: true })}
                  disabled={!watch("province")}
                >
                  <SelectTrigger><SelectValue placeholder={watch("province") ? "Select city/municipality" : "Select province first"} /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {(PH_PROVINCES_CITIES[watch("province") ?? ""] ?? []).slice().sort().map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </Fieldset>
        )}

        {step === 1 && (
          <Fieldset title="Identity verification" description="Upload a clear photo of one valid government ID. You must be 18+ to register.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="ID type" error={errors.idType?.message}>
                <Select onValueChange={(v: any) => setValue("idType", v, { shouldValidate: true })} value={watch("idType") ?? ""}>
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
              <Field label="ID number" error={errors.idNumber?.message}>
                <Input
                  inputMode="numeric"
                  placeholder="Digits and dashes only"
                  {...register("idNumber")}
                  onInput={(e) => {
                    const el = e.currentTarget as HTMLInputElement;
                    el.value = el.value.replace(/[^0-9-]/g, "");
                  }}
                />
              </Field>
            </div>
            <Label className="block">ID document</Label>
            <label className="flex cursor-pointer items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-paper px-4 py-8 text-sm text-muted-foreground hover:border-primary hover:bg-accent">
              <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
              {idFile ? (<><CheckCircle2 className="h-5 w-5 text-relief" /><span className="font-medium text-foreground">{idFile.name}</span></>) : (<><Upload className="h-5 w-5" /> Click to upload (JPG, PNG, PDF)</>)}
            </label>
          </Fieldset>
        )}

        {step === 2 && (
          <Fieldset title="Password" description="Minimum 8 characters with uppercase, lowercase, number, and special character.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Password" error={errors.password?.message}><Input type="password" {...register("password")} /></Field>
              <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" {...register("confirm")} /></Field>
            </div>
            <PasswordChecklist password={pw} />
          </Fieldset>
        )}

        {step === 3 && (
          <Fieldset title="Consent & agreements" description="Required under the Philippine Data Privacy Act of 2012 (RA 10173).">
            <label className="flex items-start gap-3 rounded-md border border-border bg-paper p-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" {...register("acceptTerms")} />
              <span className="text-muted-foreground">
                I have read and agree to the{" "}
                <TermsDialog
                  trigger={
                    <button type="button" className="font-medium text-primary hover:underline">
                      SAGIP Terms and Conditions
                    </button>
                  }
                />
                , including acceptable-use policies and the audit logging of all donations and assistance requests.
              </span>
            </label>
            {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms.message as string}</p>}
            <label className="flex items-start gap-3 rounded-md border border-border bg-paper p-3 text-sm">
              <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" {...register("acceptPrivacy")} />
              <span className="text-muted-foreground">
                <strong className="text-ink">Data Privacy Consent (RA 10173):</strong> I freely consent to SAGIP and the City DRRM Office collecting, processing, storing, and sharing my personal data and uploaded government ID strictly for identity verification, disaster relief operations, donor acknowledgment, and audit purposes, in accordance with the <a href="/about" target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">SAGIP Privacy Notice</a>. I understand my rights to access, correct, and request deletion of my data under the Data Privacy Act of 2012.
              </span>
            </label>
            {errors.acceptPrivacy && <p className="text-xs text-destructive">{errors.acceptPrivacy.message as string}</p>}
          </Fieldset>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0 || loading}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {isLast ? (
            <Button type="submit" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create account
            </Button>
          ) : (
            <Button type="button" onClick={next}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/auth" className="font-medium text-primary hover:underline">Sign in</Link></p>
      </form>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="mt-6 grid grid-cols-4 gap-2">
      {STEPS.map((s, i) => {
        const done = i < step;
        const active = i === step;
        return (
          <li key={s.key} className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${active ? "bg-primary text-primary-foreground" : done ? "bg-relief text-white" : "bg-muted text-muted-foreground"}`}>
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span className={`hidden text-xs font-medium sm:inline ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
            </div>
            <div className={`h-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          </li>
        );
      })}
    </ol>
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

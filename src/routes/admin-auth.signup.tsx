import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { signUpAdmin } from "@/lib/auth/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/sagip/PasswordInput";
import { TermsDialog } from "@/components/sagip/TermsDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PH_PROVINCES, PH_PROVINCES_CITIES } from "@/lib/ph-locations";
import { isValidEmail } from "@/lib/locations";
import { toast } from "sonner";
import { Loader2, KeyRound, Upload, CheckCircle2, ArrowLeft, ArrowRight, Check, AlertTriangle } from "lucide-react";

const passwordRules = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

const idTypeEnum = z.enum([
  "national_id",
  "drivers_license",
  "passport",
  "umid",
  "postal_id",
  "voters_id",
]);

const ID_TYPE_LABELS: Record<z.infer<typeof idTypeEnum>, string> = {
  national_id: "Philippine National ID (PhilID)",
  drivers_license: "Driver's License",
  passport: "Philippine Passport",
  umid: "UMID",
  postal_id: "Postal ID",
  voters_id: "Voter's ID",
};

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Required").max(80),
    middleName: z.string().trim().max(80).optional(),
    lastName: z.string().trim().min(1, "Required").max(80),
    birthDate: z.string().refine((v) => {
      if (!v) return false;
      const d = new Date(v); if (isNaN(d.getTime())) return false;
      const age = (Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000);
      return age >= 18 && age <= 120;
    }, "Age must be between 18 and 120 years"),
    gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
    mobile: z.string().regex(/^(\+?63|0)?9\d{9}$/, "Use a valid PH mobile (09XXXXXXXXX)"),
    email: z.string().refine(isValidEmail, "Enter a valid email address").transform((v) => v.toLowerCase()),
    address: z.string().trim().min(5, "Required").max(200),
    city: z.string().min(2, "Required").max(80),
    province: z.string().min(2, "Required").max(80),
    inviteCode: z.string().trim().min(4, "Required").max(80),
    idType: idTypeEnum,
    idNumber: z.string()
      .trim()
      .min(3, "Required")
      .max(50)
      .regex(/^[0-9-]+$/, "ID number may contain digits and dashes only"),
    password: passwordRules,
    confirm: z.string().min(1, "Please confirm your password"),
    acceptTerms: z.literal(true, { errorMap: () => ({ message: "You must accept the Terms and Conditions" }) }),
    acceptPrivacy: z.literal(true, { errorMap: () => ({ message: "Consent to data processing is required under RA 10173" }) }),
  })
  .superRefine((d, ctx) => {
    if (!d.confirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirm"], message: "Please confirm your password" });
    } else if (d.password !== d.confirm) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["confirm"], message: "Passwords do not match" });
    }
  });

type FormVals = z.infer<typeof schema>;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const Route = createFileRoute("/admin-auth/signup")({
  head: () => ({
    meta: [
      { title: "Admin registration — SAGIP" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSignup,
});

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const idx = result.indexOf(",");
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const STEPS = [
  { key: "personal", label: "Personal Information" },
  { key: "identity", label: "Identity Verification" },
  { key: "password", label: "Password" },
  { key: "consent", label: "Consent & Agreements" },
] as const;

const STEP_FIELDS: Record<number, (keyof FormVals)[]> = {
  0: ["firstName", "middleName", "lastName", "birthDate", "gender", "mobile", "email", "address", "city", "province"],
  1: ["inviteCode", "idType", "idNumber"],
  2: ["password", "confirm"],
  3: ["acceptTerms", "acceptPrivacy"],
};

function AdminSignup() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const { register, handleSubmit, setValue, watch, trigger, formState: { errors } } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { acceptTerms: false as any, acceptPrivacy: false as any },
  });

  const idType = watch("idType");
  const city = watch("city");
  const province = watch("province");
  const gender = watch("gender");
  const birthDate = watch("birthDate");
  const computedAge = (() => {
    if (!birthDate) return null;
    const d = new Date(birthDate); if (isNaN(d.getTime())) return null;
    const t = new Date();
    let a = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
    return a;
  })();

  const next = async () => {
    const fields = STEP_FIELDS[step];
    const ok = await trigger(fields as any);
    if (!ok) return;
    if (step === 1) {
      if (!idFile) { toast.error("Please upload a government-issued ID"); return; }
      if (!ALLOWED_MIME.includes(idFile.type)) { toast.error("ID must be JPG, PNG, WEBP, or PDF"); return; }
      if (idFile.size > MAX_BYTES) { toast.error("ID must be 5MB or smaller"); return; }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = async (vals: FormVals) => {
    if (!idFile) { toast.error("Please upload a government-issued ID"); setStep(1); return; }
    if (!ALLOWED_MIME.includes(idFile.type)) { toast.error("ID must be JPG, PNG, WEBP, or PDF"); return; }
    if (idFile.size > MAX_BYTES) { toast.error("ID must be 5MB or smaller"); return; }

    setLoading(true);
    try {
      const base64 = await fileToBase64(idFile);
      await signUpAdmin({
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
          inviteCode: vals.inviteCode,
          idType: vals.idType,
          idNumber: vals.idNumber,
          idFileName: idFile.name,
          idFileMime: idFile.type,
          idFileBase64: base64,
        },
      });

      const { error: signErr } = await supabase.auth.signInWithPassword({ email: vals.email, password: vals.password });
      if (signErr) {
        toast.success("Admin account created. Please sign in.");
        navigate({ to: "/admin-auth" });
        return;
      }
      toast.success("Administrator account created");
      await router.invalidate();
      navigate({ to: "/admin" });
    } catch (e: any) {
      toast.error(e?.message ?? "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const isLast = step === STEPS.length - 1;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 lg:px-8">
      <div className="rounded-2xl bg-paper p-8 text-foreground shadow-2xl sm:p-10">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-2xl font-semibold">Administrator registration</h1>
            <p className="text-sm text-muted-foreground">Requires a single-use invite code, complete personal details, and a valid government-issued ID.</p>
          </div>
        </div>

        <Stepper step={step} />

        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-6">
          {step === 0 && (
            <Section title="Personal information">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="First name" error={errors.firstName?.message}><Input {...register("firstName")} /></Field>
                <Field label="Middle name" optional><Input {...register("middleName")} /></Field>
                <Field label="Last name" error={errors.lastName?.message}><Input {...register("lastName")} /></Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Birth date" error={errors.birthDate?.message}>
                  <Input type="date" {...register("birthDate")} max={new Date().toISOString().slice(0,10)} />
                </Field>
                <Field label="Gender" error={errors.gender?.message}>
                  <Select value={gender ?? ""} onValueChange={(v: any) => setValue("gender", v, { shouldValidate: true })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Mobile number" error={errors.mobile?.message}>
                  <Input placeholder="09XXXXXXXXX" {...register("mobile")} />
                </Field>
              </div>
              {computedAge !== null && computedAge > 120 && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>The age you entered exceeds 120 years. Please verify your birth date — registration is limited to ages 18–120.</span>
                </div>
              )}
              <Field label="Email address" error={errors.email?.message}>
                <Input type="email" placeholder="name@city.gov.ph" {...register("email")} />
              </Field>
              <Field label="Residential address" error={errors.address?.message}><Input {...register("address")} /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Province" error={errors.province?.message}>
                  <Select
                    value={province ?? ""}
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
                    value={city ?? ""}
                    onValueChange={(v) => setValue("city", v, { shouldValidate: true })}
                    disabled={!province}
                  >
                    <SelectTrigger><SelectValue placeholder={province ? "Select city/municipality" : "Select province first"} /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {(PH_PROVINCES_CITIES[province ?? ""] ?? []).slice().sort().map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </Section>
          )}

          {step === 1 && (
            <>
              <Section title="Invite code" description="A single-use code issued by an existing SAGIP administrator.">
                <Field label="Invite code" error={errors.inviteCode?.message}>
                  <Input placeholder="SAGIP-ADMIN-XXXX" {...register("inviteCode")} className="font-mono uppercase" />
                </Field>
              </Section>

              <Section title="Identity verification" description="Documents are stored securely and reviewed by the SAGIP DRRM Office.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="ID type" error={errors.idType?.message}>
                    <Select value={idType ?? ""} onValueChange={(v) => setValue("idType", v as FormVals["idType"], { shouldValidate: true })}>
                      <SelectTrigger><SelectValue placeholder="Select ID type" /></SelectTrigger>
                      <SelectContent>
                        {(Object.keys(ID_TYPE_LABELS) as Array<keyof typeof ID_TYPE_LABELS>).map((k) => (
                          <SelectItem key={k} value={k}>{ID_TYPE_LABELS[k]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="ID number" error={errors.idNumber?.message}>
                    <Input {...register("idNumber")} placeholder="As printed on the ID" />
                  </Field>
                </div>
                <Label className="text-sm">ID document (JPG, PNG, WEBP, or PDF — max 5MB)</Label>
                <label htmlFor="admin-id-file" className="mt-1.5 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background p-3 text-sm transition-colors hover:bg-accent">
                  {idFile ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-relief" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{idFile.name}</p>
                        <p className="text-xs text-muted-foreground">{(idFile.size / 1024).toFixed(0)} KB · {idFile.type || "unknown"}</p>
                      </div>
                      <span className="text-xs font-medium text-primary">Change file</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="font-medium">Upload your government-issued ID</p>
                        <p className="text-xs text-muted-foreground">Ensure all text is legible.</p>
                      </div>
                    </>
                  )}
                </label>
                <input id="admin-id-file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="sr-only" onChange={(e) => setIdFile(e.target.files?.[0] ?? null)} />
              </Section>
            </>
          )}

          {step === 2 && (
            <Section title="Password" description="Minimum 8 characters with uppercase, lowercase, number, and special character.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Password" error={errors.password?.message}><PasswordInput {...register("password")} /></Field>
                <Field label="Confirm password" error={errors.confirm?.message}><PasswordInput {...register("confirm")} /></Field>
              </div>
            </Section>
          )}

          {step === 3 && (
            <Section title="Consent & agreements" description="Required under the Philippine Data Privacy Act of 2012 (RA 10173).">
              <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm">
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
                  , the DRRM acceptable-use policy, and audit logging of all administrative actions.
                </span>
              </label>
              {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms.message as string}</p>}
              <label className="flex items-start gap-3 rounded-md border border-border bg-background p-3 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-primary" {...register("acceptPrivacy")} />
                <span className="text-muted-foreground">
                  <strong className="text-foreground">Data Privacy Consent (RA 10173):</strong> I consent to SAGIP and the City DRRM Office collecting, processing, storing, and sharing my personal data and uploaded government ID strictly for identity verification, administrative access control, and audit purposes, in accordance with the SAGIP Privacy Notice.
                </span>
              </label>
              {errors.acceptPrivacy && <p className="text-xs text-destructive">{errors.acceptPrivacy.message as string}</p>}
            </Section>
          )}

          <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button type="button" variant="outline" onClick={back} disabled={step === 0 || loading}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            {isLast ? (
              <Button type="submit" size="lg" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create admin account
              </Button>
            ) : (
              <Button type="button" onClick={next}>
                Next <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already an administrator?{" "}
          <Link to="/admin-auth" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
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

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-muted/30 p-4">
      <p className="font-display text-sm font-semibold">{title}</p>
      {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
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

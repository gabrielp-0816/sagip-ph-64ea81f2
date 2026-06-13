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
import { toast } from "sonner";
import { Loader2, KeyRound } from "lucide-react";

const passwordRules = z.string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Must contain an uppercase letter")
  .regex(/[a-z]/, "Must contain a lowercase letter")
  .regex(/[0-9]/, "Must contain a number")
  .regex(/[^A-Za-z0-9]/, "Must contain a special character");

const schema = z.object({
  firstName: z.string().trim().min(1, "Required").max(80),
  lastName: z.string().trim().min(1, "Required").max(80),
  email: z.string().email().max(255),
  inviteCode: z.string().trim().min(4, "Required").max(80),
  password: passwordRules,
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, { message: "Passwords do not match", path: ["confirm"] });

type FormVals = z.infer<typeof schema>;

export const Route = createFileRoute("/admin-auth/signup")({
  head: () => ({ meta: [{ title: "Admin registration — SAGIP" }, { name: "robots", content: "noindex" }] }),
  component: AdminSignup,
});

function AdminSignup() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormVals>({ resolver: zodResolver(schema) });

  const onSubmit = async (vals: FormVals) => {
    setLoading(true);
    try {
      await signUpAdmin({
        data: {
          email: vals.email,
          password: vals.password,
          firstName: vals.firstName,
          lastName: vals.lastName,
          inviteCode: vals.inviteCode,
        },
      });
      // Auto sign-in the newly created admin.
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

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 lg:px-8">
      <div className="rounded-2xl bg-paper p-8 text-foreground shadow-2xl sm:p-10">
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-primary/10 p-2 text-primary"><KeyRound className="h-5 w-5" /></span>
          <div>
            <h1 className="font-display text-2xl font-semibold">Administrator registration</h1>
            <p className="text-sm text-muted-foreground">Requires a single-use invite code issued by an existing administrator.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" error={errors.firstName?.message}><Input {...register("firstName")} /></Field>
            <Field label="Last name" error={errors.lastName?.message}><Input {...register("lastName")} /></Field>
          </div>
          <Field label="Official email" error={errors.email?.message}><Input type="email" placeholder="name@city.gov.ph" {...register("email")} /></Field>
          <Field label="Invite code" error={errors.inviteCode?.message}>
            <Input placeholder="SAGIP-ADMIN-XXXX" {...register("inviteCode")} className="font-mono uppercase" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" error={errors.password?.message}><Input type="password" {...register("password")} /></Field>
            <Field label="Confirm password" error={errors.confirm?.message}><Input type="password" {...register("confirm")} /></Field>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
            <p className="text-xs text-muted-foreground">By registering you agree to the DRRM Office acceptable-use policy and audit logging.</p>
            <Button type="submit" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Create admin account
            </Button>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already an administrator? <Link to="/admin-auth" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-sm">{label}</Label>
      <div className="mt-1.5">{children}</div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}

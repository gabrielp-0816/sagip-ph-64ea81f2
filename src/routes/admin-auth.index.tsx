import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { ensureSuperAdmin } from "@/lib/auth/super-admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/sagip/PasswordInput";
import { toast } from "sonner";
import { Loader2, ShieldAlert } from "lucide-react";

const schema = z.object({
  email: z.string().min(1, "Email is required"),
  password: z.string().min(1, "Password is required"),
});
type FormVals = z.infer<typeof schema>;

export const Route = createFileRoute("/admin-auth/")({
  head: () => ({ meta: [{ title: "Admin sign in — SAGIP" }, { name: "robots", content: "noindex" }] }),
  component: AdminSignIn,
});

function AdminSignIn() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { email: "admin@sagip.local", password: "admin123" }
  });

  // Idempotently ensure the built-in Super Admin (admin@sagip.local / admin123) exists on first load.
  const ensure = useServerFn(ensureSuperAdmin);
  useEffect(() => { ensure().catch(() => undefined); }, [ensure]);

  const onSubmit = async (vals: FormVals) => {
    setLoading(true);
    // Accept the well-known "admin" username as shorthand for the super admin email.
    let email = vals.email.trim();
    if (email.toLowerCase() === "admin") email = "admin@sagip.local";

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: vals.password });
    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Sign-in failed");
      return;
    }
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .eq("role", "admin")
      .maybeSingle();
    setLoading(false);
    if (!roleRow) {
      await supabase.auth.signOut();
      toast.error("This account does not have administrator access.");
      return;
    }
    toast.success("Welcome, Administrator");
    await router.invalidate();
    navigate({ to: "/admin" });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 md:grid-cols-2 md:py-20 lg:px-8">
      <div className="hidden md:block">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">Restricted area</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">SAGIP Administrator Portal</h1>
          <p className="mt-4 text-sm text-paper/70">
            For authorized SAGIP DRRM personnel only. All actions performed inside the admin console are recorded in
            an immutable audit log.
          </p>
          <div className="mt-8 flex items-start gap-3 rounded-lg border border-gold/30 bg-gold/10 p-4 text-xs text-paper/80">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
            <p>Unauthorized access attempts are logged and may be subject to administrative and legal action under RA 10173.</p>
          </div>
        </div>
      </div>
      <div>
        <div className="mx-auto max-w-md rounded-2xl bg-paper p-8 text-foreground shadow-2xl">
          <h2 className="font-display text-2xl font-semibold">Administrator sign in</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your assigned admin credentials.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email or username</Label>
              <Input id="email" autoComplete="username" {...register("email")} className="mt-1.5" placeholder="name@city.gov.ph" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" autoComplete="current-password" {...register("password")} containerClassName="mt-1.5" />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in to admin console
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Have an invite code?{" "}
            <Link to="/admin-auth/signup" className="font-medium text-primary hover:underline">Register as administrator</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

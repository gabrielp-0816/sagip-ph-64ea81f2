import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});
type FormVals = z.infer<typeof schema>;

export const Route = createFileRoute("/auth/")({
  head: () => ({ meta: [{ title: "Sign in — SAGIP" }, { name: "description", content: "Sign in to your SAGIP account to donate, request assistance, or manage disaster relief funds." }] }),
  component: SignInPage,
});

function SignInPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<FormVals>({ resolver: zodResolver(schema) });

  const onSubmit = async (vals: FormVals) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email: vals.email, password: vals.password });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Welcome back");
    await router.invalidate();
    navigate({ to: "/dashboard" });
  };

  const onGoogle = async () => {
    setGoogleLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/dashboard" });
    if (result.error) { setGoogleLoading(false); toast.error("Google sign-in failed"); return; }
    if (result.redirected) return;
    await router.invalidate();
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 md:grid-cols-2 md:py-20 lg:px-8">
      <div className="hidden md:block">
        <div className="rounded-2xl border border-border bg-card p-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Secure access</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight">A trusted civic platform.</h1>
          <p className="mt-4 text-sm text-muted-foreground">Your sign-in is protected by encrypted sessions and role-based access. SAGIP never shares your personal information.</p>
          <ul className="mt-8 space-y-3 text-sm">
            <li>• Donate to verified disaster operations</li>
            <li>• Submit and track assistance requests</li>
            <li>• Receive real-time updates from the City DRRM Office</li>
          </ul>
        </div>
      </div>
      <div>
        <div className="mx-auto max-w-md">
          <h2 className="font-display text-2xl font-semibold">Sign in to SAGIP</h2>
          <p className="mt-1 text-sm text-muted-foreground">Use your registered email and password.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" {...register("email")} className="mt-1.5" placeholder="you@example.com" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/auth/forgot" className="text-xs font-medium text-primary hover:underline">Forgot password?</Link>
              </div>
              <Input id="password" type="password" autoComplete="current-password" {...register("password")} className="mt-1.5" />
              {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>}
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Checkbox {...register("remember")} /> Remember me
            </label>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" /> OR <div className="h-px flex-1 bg-border" />
          </div>

          <Button type="button" variant="outline" className="w-full" size="lg" onClick={onGoogle} disabled={googleLoading}>
            {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />} Continue with Google
          </Button>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            New to SAGIP?{" "}
            <Link to="/auth/signup" className="font-medium text-primary hover:underline">Create an account</Link>
          </p>
          <p className="mt-3 text-center text-sm text-muted-foreground">
            Administrator?{" "}
            <Link to="/admin-auth" className="font-medium text-primary hover:underline">Sign in to admin portal</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.75h3.57c2.08-1.92 3.22-4.74 3.22-8.3z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.75c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.12A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.45.34-2.12V7.04H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.96l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.65l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.04l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"/>
    </svg>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const schema = z.object({ email: z.string().email() });
type V = z.infer<typeof schema>;

export const Route = createFileRoute("/auth/forgot")({
  head: () => ({ meta: [{ title: "Forgot password — SAGIP" }] }),
  component: () => {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);
    const { register, handleSubmit, formState: { errors } } = useForm<V>({ resolver: zodResolver(schema) });
    const onSubmit = async (v: V) => {
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: window.location.origin + "/reset-password" });
      setLoading(false);
      if (error) { toast.error(error.message); return; }
      setSent(true); toast.success("Password reset email sent");
    };
    return (
      <div className="mx-auto max-w-md px-4 py-16 lg:px-8">
        <h1 className="font-display text-2xl font-semibold">Reset your password</h1>
        <p className="mt-1 text-sm text-muted-foreground">We'll email you a secure link to set a new password.</p>
        {sent ? (
          <div className="mt-6 rounded-md border border-relief/30 bg-relief/10 p-4 text-sm text-foreground">
            Check your inbox for the reset link.
          </div>
        ) : (
          <form className="mt-8 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...register("email")} className="mt-1.5" />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link</Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm text-muted-foreground"><Link to="/auth" className="font-medium text-primary hover:underline">Back to sign in</Link></p>
      </div>
    );
  },
});

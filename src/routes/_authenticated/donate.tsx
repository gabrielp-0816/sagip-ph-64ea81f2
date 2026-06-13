import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashShell } from "@/components/sagip/DashShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, HandHeart, ShieldCheck, Receipt } from "lucide-react";
import { formatPHP } from "@/lib/format";

const schema = z.object({
  amount: z.coerce.number().positive("Enter an amount greater than zero").max(10_000_000, "Amount exceeds maximum"),
  disaster_id: z.string().uuid().optional().or(z.literal("")),
  payment_method: z.enum(["bank_transfer", "gcash", "maya", "credit_card", "cash"]),
  reference_number: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  is_anonymous: z.boolean().optional(),
});

type FormVals = z.infer<typeof schema>;

const PRESETS = [200, 500, 1000, 2500, 5000, 10000];

export const Route = createFileRoute("/_authenticated/donate")({
  head: () => ({ meta: [{ title: "Donate — SAGIP" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ disaster: typeof s.disaster === "string" ? s.disaster : undefined }),
  component: DonatePage,
});

function DonatePage() {
  const { disaster } = Route.useSearch();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);

  const { data: disasters } = useQuery({
    queryKey: ["donate-disasters"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? "";
      const { data } = await supabase
        .from("disasters")
        .select("id,name,city,required_funding,raised_amount,created_by")
        .eq("status", "active")
        .order("created_at", { ascending: false });
      // Hide campaigns the current user created — they can't donate to their own.
      return (data ?? []).filter((d: any) => d.created_by !== uid);
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["donate-profile"],
    queryFn: async () =>
      (await supabase.from("profiles").select("first_name,last_name,email").maybeSingle()).data,
  });

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { amount: 500, disaster_id: disaster ?? "", payment_method: "gcash", is_anonymous: false },
  });

  useEffect(() => { if (disaster) setValue("disaster_id", disaster); }, [disaster, setValue]);

  const selected = useMemo(() => disasters?.find((d) => d.id === watch("disaster_id")), [disasters, watch]);
  const amount = Number(watch("amount") || 0);

  const onSubmit = async (vals: FormVals) => {
    if (!profile) { toast.error("Profile not loaded"); return; }
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getUser();
    if (vals.disaster_id) {
      const { data: d } = await supabase.from("disasters").select("created_by").eq("id", vals.disaster_id).maybeSingle();
      if (d?.created_by === auth.user?.id) {
        setSubmitting(false);
        toast.error("You can't donate to a disaster campaign you created.");
        return;
      }
    }
    const donorName = vals.is_anonymous ? "Anonymous donor" : `${profile.first_name} ${profile.last_name}`;
    const { error } = await supabase.from("donations").insert({
      donor_id: auth.user?.id,
      donor_name: donorName,
      donor_email: vals.is_anonymous ? null : profile.email,
      disaster_id: vals.disaster_id || null,
      amount: vals.amount,
      payment_method: vals.payment_method,
      reference_number: vals.reference_number || null,
      message: vals.message || null,
      is_anonymous: !!vals.is_anonymous,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Thank you — your donation has been recorded.");
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    reset({ amount: 500, disaster_id: vals.disaster_id, payment_method: vals.payment_method, is_anonymous: false, reference_number: "", message: "" });
  };

  return (
    <DashShell title="Donate to disaster relief" subtitle="Your contribution is logged on-chain of custody and visible on the Transparency Portal.">
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          <section>
            <h2 className="font-display text-lg font-semibold">1. Choose where your donation goes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Direct your funds to a specific disaster campaign, or contribute to the general DRRM fund.</p>
            <div className="mt-4">
              <Label htmlFor="disaster">Disaster campaign</Label>
              <Select value={watch("disaster_id") || "__general__"} onValueChange={(v) => setValue("disaster_id", v === "__general__" ? "" : v)}>
                <SelectTrigger id="disaster" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__general__">General DRRM Fund</SelectItem>
                  {(disasters ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name} — {d.city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">2. Amount</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setValue("amount", p, { shouldValidate: true })}
                  className={`rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition-colors ${amount === p ? "border-primary bg-primary text-primary-foreground" : "border-border bg-paper hover:border-primary/40"}`}
                >
                  ₱{p.toLocaleString()}
                </button>
              ))}
            </div>
            <div className="mt-4">
              <Label htmlFor="amount">Custom amount (PHP)</Label>
              <Input id="amount" type="number" min={1} step="0.01" {...register("amount")} className="mt-1.5" />
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">3. Payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">Choose how you will remit the funds. The City Treasurer's Office will reconcile transactions within 1 business day.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="method">Payment method</Label>
                <Select value={watch("payment_method")} onValueChange={(v) => setValue("payment_method", v as any)}>
                  <SelectTrigger id="method" className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="maya">Maya</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer (Landbank)</SelectItem>
                    <SelectItem value="credit_card">Credit / debit card</SelectItem>
                    <SelectItem value="cash">Cash at City Treasurer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ref">Reference number (optional)</Label>
                <Input id="ref" placeholder="e.g. GC-2026-009124" {...register("reference_number")} className="mt-1.5" />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border bg-paper p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-ink">Remittance details</p>
              <p className="mt-1">Account name: <span className="font-medium text-ink">City Government DRRM Trust Fund</span></p>
              <p>Landbank account: <span className="font-medium text-ink">1234-5678-90</span> · GCash: <span className="font-medium text-ink">0917-SAGIP-00</span></p>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">4. Message (optional)</h2>
            <Textarea {...register("message")} placeholder="A message of solidarity for the responders and recipients." className="mt-3" rows={3} />
            <label className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox checked={!!watch("is_anonymous")} onCheckedChange={(v) => setValue("is_anonymous", !!v)} />
              <span>List my donation as anonymous on the public Transparency Portal. (The City DRRM Office still keeps your identity for audit and receipt purposes.)</span>
            </label>
          </section>

          <Button type="submit" size="lg" variant="relief" disabled={submitting} className="w-full sm:w-auto">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} <HandHeart className="h-4 w-4" /> Record donation of {formatPHP(amount)}
          </Button>
        </form>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-relief">
              <ShieldCheck className="h-4 w-4" /> Verified channel
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold">Where your money goes</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>• 100% of donations go to relief — no platform fees.</li>
              <li>• Every release is approved by the City DRRM Council and published on the Transparency Portal.</li>
              <li>• You receive an official receipt by email after the Treasurer's Office reconciles the transaction.</li>
            </ul>
          </div>

          {selected ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Supporting</p>
              <p className="mt-1 font-display text-lg font-semibold">{selected.name}</p>
              <p className="text-sm text-muted-foreground">{selected.city}</p>
              <div className="mt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raised</span>
                  <span className="font-semibold tabular-nums">{formatPHP(selected.raised_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold tabular-nums">{formatPHP(selected.required_funding)}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
              You are contributing to the <strong className="text-ink">General DRRM Fund</strong>. It bankrolls preparedness training, equipment, and rapid-response stockpiles across the city.
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Receipt className="h-4 w-4" /> Tax deductibility
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Donations to government DRRM trust funds are deductible under Section 34(H) of the NIRC. Your BIR-compliant receipt will be emailed within 5 working days. <Link to="/transparency" className="font-medium text-primary hover:underline">Learn more</Link></p>
          </div>
        </aside>
      </div>
    </DashShell>
  );
}

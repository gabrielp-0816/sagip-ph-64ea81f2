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
import {
  Loader2,
  HandHeart,
  ShieldCheck,
  Receipt,
  Upload,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { formatPHP } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import qrCodeImage from "@/assets/qr-code.png";

const schema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Enter the amount you want to donate" })
    .positive("Enter an amount greater than zero")
    .max(10_000_000, "Amount exceeds maximum"),
  disaster_id: z.string().uuid().optional().or(z.literal("")),
  payment_method: z.enum(["bank_transfer", "gcash", "maya", "credit_card", "cash"]),
  reference_number: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().max(500).optional().or(z.literal("")),
  is_anonymous: z.boolean().optional(),
});

type FormVals = z.infer<typeof schema>;

const MAX_PROOF_SIZE = 5 * 1024 * 1024;
const PROOF_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export const Route = createFileRoute("/_authenticated/donate")({
  head: () => ({ meta: [{ title: "Donate — SAGIP" }] }),
  validateSearch: (s: Record<string, unknown>): { disaster?: string } => ({
    disaster: typeof s.disaster === "string" ? s.disaster : undefined,
  }),
  component: DonatePage,
});

function DonatePage() {
  const { disaster } = Route.useSearch();
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);

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
      return (data ?? []).filter((d: any) => d.created_by !== uid);
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["donate-profile"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      return (
        await supabase
          .from("profiles")
          .select("first_name,last_name,email")
          .eq("id", auth.user.id)
          .maybeSingle()
      ).data;
    },
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: { disaster_id: disaster ?? "", payment_method: "gcash", is_anonymous: false },
  });

  useEffect(() => {
    if (disaster) setValue("disaster_id", disaster);
  }, [disaster, setValue]);

  const selected = useMemo(
    () => disasters?.find((d) => d.id === watch("disaster_id")),
    [disasters, watch],
  );
  const amount = Number(watch("amount") || 0);

  const onPickProof = (f: File | null) => {
    if (!f) {
      setProofFile(null);
      return;
    }
    if (!PROOF_MIME.includes(f.type)) {
      toast.error("Proof must be JPG, PNG, WEBP, or PDF");
      return;
    }
    if (f.size > MAX_PROOF_SIZE) {
      toast.error("Proof must be 5MB or smaller");
      return;
    }
    setProofFile(f);
  };

  const onSubmit = async (vals: FormVals) => {
    if (!profile) {
      toast.error("Profile not loaded");
      return;
    }
    if (!proofFile) {
      toast.error("Please upload your proof of payment (e.g. GCash or bank receipt screenshot)");
      return;
    }
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getUser();

    if (vals.disaster_id) {
      const { data: d } = await supabase
        .from("disasters")
        .select("created_by")
        .eq("id", vals.disaster_id)
        .maybeSingle();
      if (d?.created_by === auth.user?.id) {
        setSubmitting(false);
        toast.error("You can't donate to a disaster campaign you created.");
        return;
      }
    }

    // Upload proof first
    const safeName = proofFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const proofPath = `${auth.user!.id}/${Date.now()}-${safeName}`;
    const up = await supabase.storage
      .from("donation-proofs")
      .upload(proofPath, proofFile, { contentType: proofFile.type });
    if (up.error) {
      setSubmitting(false);
      toast.error(`Proof upload failed: ${up.error.message}`);
      return;
    }

    const donorName = vals.is_anonymous
      ? "Anonymous donor"
      : `${profile.first_name} ${profile.last_name}`;
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
      proof_url: up.data.path,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Thank you — your donation has been recorded.");
    queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    setProofFile(null);
    reset({
      disaster_id: vals.disaster_id,
      payment_method: vals.payment_method,
      is_anonymous: false,
      reference_number: "",
      message: "",
    });
  };

  return (
    <DashShell
      title="Donate to disaster relief"
      subtitle="Your contribution is logged in the SAGIP chain of custody and visible on the Transparency Portal."
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8"
        >
          <section>
            <h2 className="font-display text-lg font-semibold">
              1. Choose where your donation goes
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Direct your funds to a specific disaster campaign, or contribute to the SAGIP General
              Fund.
            </p>
            <div className="mt-4">
              <Label htmlFor="disaster">Disaster campaign</Label>
              <Select
                value={watch("disaster_id") || "__general__"}
                onValueChange={(v) => setValue("disaster_id", v === "__general__" ? "" : v)}
              >
                <SelectTrigger id="disaster" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__general__">SAGIP General Fund</SelectItem>
                  {(disasters ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} — {d.city}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">2. Amount</h2>
            <div className="mt-4">
              <Label htmlFor="amount">Donation amount (PHP)</Label>
              <Input
                id="amount"
                type="text"
                inputMode="decimal"
                placeholder="Enter amount"
                {...register("amount")}
                className="mt-1.5"
              />
              {errors.amount && (
                <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">3. Payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose how you remitted the funds. The SAGIP Treasury reconciles transactions within 1
              business day.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="method">Payment method</Label>
                <Select
                  value={watch("payment_method")}
                  onValueChange={(v) => setValue("payment_method", v as any)}
                >
                  <SelectTrigger id="method" className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gcash">GCash</SelectItem>
                    <SelectItem value="maya">Maya</SelectItem>
                    <SelectItem value="bank_transfer">Bank transfer (Landbank)</SelectItem>
                    <SelectItem value="credit_card">Credit / debit card</SelectItem>
                    <SelectItem value="cash">Cash at SAGIP Treasury</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ref">Reference number (optional)</Label>
                <Input
                  id="ref"
                  placeholder="e.g. GC-2026-009124"
                  {...register("reference_number")}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-dashed border-border bg-paper p-4 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="font-semibold text-ink">Remittance details</p>
                <p className="mt-1">
                  Account name: <span className="font-medium text-ink">SAGIP DRRM Trust Fund</span>
                </p>
                <p>
                  Landbank account: <span className="font-medium text-ink">1234-5678-90</span> ·
                  GCash: <span className="font-medium text-ink">0917-123-4567</span>
                </p>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 flex items-center gap-1.5"
                  >
                    <QrCode className="h-4 w-4" /> Show QR Code
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md text-center">
                  <DialogHeader>
                    <DialogTitle className="text-center">SAGIP DRRM Fund QR Code</DialogTitle>
                  </DialogHeader>
                  <div className="flex flex-col items-center justify-center p-4">
                    <img
                      src={qrCodeImage}
                      alt="SAGIP Donation QR Code"
                      className="w-64 h-64 object-contain rounded-lg border bg-white p-2"
                    />
                    <p className="mt-4 text-xs text-muted-foreground">
                      Scan this QR code using your GCash, Maya, or bank app to transfer your
                      donation.
                    </p>
                    <Button variant="link" size="sm" asChild className="mt-2 text-xs">
                      <a href={qrCodeImage} target="_blank" rel="noopener noreferrer">
                        Open in new tab
                      </a>
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="mt-4">
              <Label>
                Proof of payment <span className="text-destructive">*</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Upload a screenshot of your GCash / Maya / bank transfer receipt (JPG, PNG, WEBP, or
                PDF — max 5MB).
              </p>
              <label
                htmlFor="proof"
                className="mt-2 flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-border bg-paper p-4 text-sm hover:border-primary/40"
              >
                {proofFile ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-relief" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{proofFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(proofFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <span className="text-xs font-medium text-primary">Change</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Click to upload your payment receipt
                    </span>
                  </>
                )}
              </label>
              <input
                id="proof"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                className="sr-only"
                onChange={(e) => onPickProof(e.target.files?.[0] ?? null)}
              />
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">4. Message (optional)</h2>
            <Textarea
              {...register("message")}
              placeholder="A message of solidarity for the responders and recipients."
              className="mt-3"
              rows={3}
            />
            <label className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
              <Checkbox
                checked={!!watch("is_anonymous")}
                onCheckedChange={(v) => setValue("is_anonymous", !!v)}
              />
              <span>
                List my donation as anonymous on the public Transparency Portal. (SAGIP still keeps
                your identity for audit and receipt purposes.)
              </span>
            </label>
          </section>

          <Button
            type="submit"
            size="lg"
            variant="relief"
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}{" "}
            <HandHeart className="h-4 w-4" /> Record donation
            {amount > 0 ? ` of ${formatPHP(amount)}` : ""}
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
              <li>
                • Every release is approved by the SAGIP DRRM Council and published on the
                Transparency Portal.
              </li>
              <li>
                • You receive an official receipt by email after SAGIP Treasury reconciles the
                transaction.
              </li>
            </ul>
          </div>

          {selected ? (
            <div className="rounded-xl border border-border bg-card p-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Supporting
              </p>
              <p className="mt-1 font-display text-lg font-semibold">{selected.name}</p>
              <p className="text-sm text-muted-foreground">{selected.city}</p>
              <div className="mt-4 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Raised</span>
                  <span className="font-semibold tabular-nums">
                    {formatPHP(selected.raised_amount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Target</span>
                  <span className="font-semibold tabular-nums">
                    {formatPHP(selected.required_funding)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-sm text-muted-foreground">
              You are contributing to the <strong className="text-ink">SAGIP General Fund</strong>.
              It bankrolls preparedness training, equipment, and rapid-response stockpiles citywide.
            </div>
          )}

          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              <Receipt className="h-4 w-4" /> Tax deductibility
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Donations to government DRRM trust funds are deductible under Section 34(H) of the
              NIRC. Your BIR-compliant receipt will be emailed within 5 working days.{" "}
              <Link to="/transparency" className="font-medium text-primary hover:underline">
                Learn more
              </Link>
            </p>
          </div>
        </aside>
      </div>
    </DashShell>
  );
}

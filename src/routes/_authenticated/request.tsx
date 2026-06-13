import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Upload, FileText, AlertTriangle, X } from "lucide-react";

const schema = z.object({
  disaster_id: z.string().uuid().optional().or(z.literal("")),
  category_id: z.string().uuid({ message: "Select a disaster category" }),
  disaster_description: z.string().trim().min(20, "Describe the situation in at least 20 characters").max(2000),
  city: z.string().trim().min(2, "Required").max(100),
  barangay: z.string().trim().min(2, "Required").max(100),
  exact_location: z.string().trim().min(5, "Required").max(200),
  affected_individuals: z.coerce.number().int().min(1, "Must affect at least 1 person").max(1_000_000),
  estimated_damage_cost: z.coerce.number().min(0).max(1_000_000_000),
  requested_amount: z.coerce.number().positive("Enter an amount greater than zero").max(50_000_000),
});

type FormVals = z.infer<typeof schema>;

const MAX_FILES = 5;
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export const Route = createFileRoute("/_authenticated/request")({
  head: () => ({ meta: [{ title: "Request assistance — SAGIP" }] }),
  validateSearch: (s: Record<string, unknown>) => ({ disaster: typeof s.disaster === "string" ? s.disaster : undefined }),
  component: RequestPage,
});

function RequestPage() {
  const { disaster } = Route.useSearch();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const { data: categories } = useQuery({
    queryKey: ["request-categories"],
    queryFn: async () => (await supabase.from("disaster_categories").select("id,name").order("name")).data ?? [],
  });

  const { data: disasters } = useQuery({
    queryKey: ["request-disasters"],
    queryFn: async () =>
      (await supabase.from("disasters").select("id,name,city,category_id").eq("status", "active").order("created_at", { ascending: false })).data ?? [],
  });

  const { data: profile } = useQuery({
    queryKey: ["request-profile"],
    queryFn: async () => (await supabase.from("profiles").select("city,is_verified").maybeSingle()).data,
  });

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormVals>({
    resolver: zodResolver(schema),
    defaultValues: {
      disaster_id: disaster ?? "",
      affected_individuals: 1,
      estimated_damage_cost: 0,
      requested_amount: 0,
    },
  });

  useEffect(() => {
    if (profile?.city && !watch("city")) setValue("city", profile.city);
  }, [profile, setValue, watch]);

  useEffect(() => {
    if (disaster) {
      setValue("disaster_id", disaster);
      const d = disasters?.find((x) => x.id === disaster);
      if (d) {
        setValue("category_id", d.category_id);
        setValue("city", d.city);
      }
    }
  }, [disaster, disasters, setValue]);

  const onFilesPicked = (list: FileList | null) => {
    if (!list) return;
    const incoming = Array.from(list);
    const accepted: File[] = [];
    for (const f of incoming) {
      if (!ALLOWED.includes(f.type)) { toast.error(`${f.name}: only PDF, PNG, JPG, WEBP allowed`); continue; }
      if (f.size > MAX_SIZE) { toast.error(`${f.name}: exceeds 10 MB`); continue; }
      accepted.push(f);
    }
    setFiles((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
  };

  const onSubmit = async (vals: FormVals) => {
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user!.id;

      const { data: created, error } = await supabase
        .from("fund_requests")
        .insert({
          requester_id: userId,
          disaster_id: vals.disaster_id || null,
          category_id: vals.category_id,
          disaster_description: vals.disaster_description,
          city: vals.city,
          barangay: vals.barangay,
          exact_location: vals.exact_location,
          affected_individuals: vals.affected_individuals,
          estimated_damage_cost: vals.estimated_damage_cost,
          requested_amount: vals.requested_amount,
        })
        .select("id")
        .single();
      if (error) throw error;

      for (const f of files) {
        const path = `${userId}/${created.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await supabase.storage.from("request-documents").upload(path, f, { contentType: f.type });
        if (up.error) { toast.error(`Upload failed: ${f.name}`); continue; }
        await supabase.from("uploaded_documents").insert({
          owner_id: userId,
          related_type: "fund_request",
          related_id: created.id,
          file_path: up.data.path,
          file_name: f.name,
          mime_type: f.type,
        });
      }

      toast.success("Request submitted. You'll be notified once it is reviewed.");
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      navigate({ to: "/requests" });
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DashShell title="Request disaster assistance" subtitle="Submit a verified request for relief funding. All submissions are reviewed by the City DRRM Office.">
      {profile && !profile.is_verified && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-foreground" />
          <div>
            <p className="font-semibold text-ink">Your account is pending verification</p>
            <p className="text-muted-foreground">You may still submit a request, but it will only be processed after the DRRM Office verifies your uploaded valid ID. Verification typically takes 1 business day.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6 rounded-xl border border-border bg-card p-6 sm:p-8">
          <section>
            <h2 className="font-display text-lg font-semibold">Disaster context</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="d">Active disaster (optional)</Label>
                <Select value={watch("disaster_id") || "__none__"} onValueChange={(v) => {
                  setValue("disaster_id", v === "__none__" ? "" : v);
                  const d = disasters?.find((x) => x.id === v);
                  if (d) { setValue("category_id", d.category_id); setValue("city", d.city); }
                }}>
                  <SelectTrigger id="d" className="mt-1.5"><SelectValue placeholder="Select if applicable" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Not tied to a tracked disaster</SelectItem>
                    {(disasters ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name} — {d.city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="cat">Disaster category</Label>
                <Select value={watch("category_id") || ""} onValueChange={(v) => setValue("category_id", v, { shouldValidate: true })}>
                  <SelectTrigger id="cat" className="mt-1.5"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {(categories ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category_id && <p className="mt-1 text-xs text-destructive">{errors.category_id.message}</p>}
              </div>
            </div>
            <div className="mt-4">
              <Label htmlFor="desc">Describe the situation</Label>
              <Textarea id="desc" rows={5} className="mt-1.5" placeholder="When did it happen, what was destroyed, who is affected, and what immediate assistance do you need?" {...register("disaster_description")} />
              {errors.disaster_description && <p className="mt-1 text-xs text-destructive">{errors.disaster_description.message}</p>}
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Location</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="city">City / Municipality</Label>
                <Input id="city" className="mt-1.5" {...register("city")} />
                {errors.city && <p className="mt-1 text-xs text-destructive">{errors.city.message}</p>}
              </div>
              <div>
                <Label htmlFor="brgy">Barangay</Label>
                <Input id="brgy" className="mt-1.5" {...register("barangay")} />
                {errors.barangay && <p className="mt-1 text-xs text-destructive">{errors.barangay.message}</p>}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="exact">Exact address / landmark</Label>
                <Input id="exact" className="mt-1.5" {...register("exact_location")} placeholder="House #, street, sitio, landmark" />
                {errors.exact_location && <p className="mt-1 text-xs text-destructive">{errors.exact_location.message}</p>}
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Impact and amount requested</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="ind">Individuals affected</Label>
                <Input id="ind" type="number" min={1} className="mt-1.5" {...register("affected_individuals")} />
                {errors.affected_individuals && <p className="mt-1 text-xs text-destructive">{errors.affected_individuals.message}</p>}
              </div>
              <div>
                <Label htmlFor="dmg">Estimated damage (PHP)</Label>
                <Input id="dmg" type="number" min={0} step="0.01" className="mt-1.5" {...register("estimated_damage_cost")} />
              </div>
              <div>
                <Label htmlFor="req">Amount requested (PHP)</Label>
                <Input id="req" type="number" min={1} step="0.01" className="mt-1.5" {...register("requested_amount")} />
                {errors.requested_amount && <p className="mt-1 text-xs text-destructive">{errors.requested_amount.message}</p>}
              </div>
            </div>
          </section>

          <section>
            <h2 className="font-display text-lg font-semibold">Supporting documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">Upload photos of damage, barangay certifications, or proof of residency. Max {MAX_FILES} files, 10 MB each. PDF, PNG, JPG, WEBP.</p>

            <label htmlFor="files" className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-paper p-8 text-center hover:border-primary/40">
              <Upload className="h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Click to add files or drop them here</p>
              <p className="text-xs text-muted-foreground">{files.length} of {MAX_FILES} selected</p>
              <input id="files" type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => onFilesPicked(e.target.files)} />
            </label>

            {files.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between rounded border border-border bg-paper px-3 py-2 text-sm">
                    <span className="flex items-center gap-2 truncate">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">({(f.size / 1024).toFixed(0)} KB)</span>
                    </span>
                    <button type="button" onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))} aria-label="Remove file">
                      <X className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <Button type="submit" size="lg" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Submit request
          </Button>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 text-sm">
            <h3 className="font-display text-base font-semibold">What happens next?</h3>
            <ol className="mt-3 space-y-3 text-muted-foreground">
              <li><span className="font-semibold text-ink">1. Triage.</span> The DRRM Operations Center reviews your submission within 24 hours.</li>
              <li><span className="font-semibold text-ink">2. Verification.</span> A field officer may contact you for additional details or a site visit.</li>
              <li><span className="font-semibold text-ink">3. Release.</span> Approved funds are released via your enrolled disbursement channel.</li>
            </ol>
          </div>
          <div className="rounded-xl border border-warning/40 bg-warning/10 p-6 text-sm">
            <p className="font-semibold text-ink">Penalty for false claims</p>
            <p className="mt-1 text-muted-foreground">Submitting fraudulent disaster claims is punishable under RA 10121 (DRRM Act) and the Revised Penal Code. All requests are cross-checked against barangay records.</p>
          </div>
        </aside>
      </form>
    </DashShell>
  );
}

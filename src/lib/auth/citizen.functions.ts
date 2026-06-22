import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const idTypeEnum = z.enum([
  "national_id",
  "drivers_license",
  "passport",
  "umid",
  "postal_id",
  "voters_id",
]);

const schema = z.object({
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/, "Must contain an uppercase letter")
    .regex(/[a-z]/, "Must contain a lowercase letter")
    .regex(/[0-9]/, "Must contain a number")
    .regex(/[^A-Za-z0-9]/, "Must contain a special character"),
  firstName: z.string().trim().min(1).max(80),
  middleName: z.string().trim().max(80).optional().nullable(),
  lastName: z.string().trim().min(1).max(80),
  birthDate: z.string().min(4).max(20),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  mobile: z.string().trim().min(7).max(20),
  street: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(80),
  province: z.string().trim().min(2).max(80),
  postalCode: z.string().trim().min(3).max(20),
  country: z.string().trim().min(2).max(80),
  idType: idTypeEnum,
  idNumber: z.string().trim().min(3).max(50),
  idFileName: z.string().trim().min(1).max(200),
  idFileMime: z.string().trim().min(1).max(100),
  idFileBase64: z.string().min(10).max(7_500_000),
});

export const signUpCitizen = createServerFn({ method: "POST" })
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let fileBytes: Buffer;
    try {
      fileBytes = Buffer.from(data.idFileBase64, "base64");
    } catch {
      throw new Error("Invalid ID document upload");
    }
    if (fileBytes.length < 1024) throw new Error("ID document file appears to be empty");
    if (fileBytes.length > 5 * 1024 * 1024) throw new Error("ID document must be 5MB or smaller");

    // Create auth user (set email_confirm to false so they must verify via OTP/link).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: false,
      user_metadata: { first_name: data.firstName, last_name: data.lastName, role: "citizen" },
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Failed to create account");

    // Upload ID
    const safeExt =
      (data.idFileName.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "jpg";
    const path = `${userId}/id-${Date.now()}.${safeExt}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("verification-ids")
      .upload(path, fileBytes, { contentType: data.idFileMime, upsert: true });
    if (upErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`ID upload failed: ${upErr.message}`);
    }

    // Insert profile
    const fullAddress = `${data.street}, ${data.city}, ${data.province} ${data.postalCode}, ${data.country}`;
    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      first_name: data.firstName,
      middle_name: data.middleName || null,
      last_name: data.lastName,
      birth_date: data.birthDate,
      gender: data.gender,
      mobile_number: data.mobile,
      email: data.email,
      residential_address: fullAddress,
      street: data.street,
      city: data.city,
      province: data.province,
      postal_code: data.postalCode,
      country: data.country,
      id_type: data.idType,
      id_number: data.idNumber,
      id_document_path: path,
    });
    if (profErr) {
      await supabaseAdmin.storage.from("verification-ids").remove([path]);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }

    return { ok: true, userId };
  });

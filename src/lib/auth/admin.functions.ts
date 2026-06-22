import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const idTypeEnum = z.enum([
  "national_id",
  "drivers_license",
  "passport",
  "umid",
  "postal_id",
  "voters_id",
]);

const signupSchema = z.object({
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
  inviteCode: z.string().trim().min(4).max(80),
  idType: idTypeEnum,
  idNumber: z.string().trim().min(3).max(50),
  idFileName: z.string().trim().min(1).max(200),
  idFileMime: z.string().trim().min(1).max(100),
  idFileBase64: z.string().min(10).max(7_500_000),
});

export const signUpAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Validate invite code.
    const { data: code, error: codeErr } = await supabaseAdmin
      .from("admin_invite_codes")
      .select("id, code, used_at, expires_at")
      .eq("code", data.inviteCode)
      .maybeSingle();
    if (codeErr) throw new Error(codeErr.message);
    if (!code) throw new Error("Invalid invite code");
    if (code.used_at) throw new Error("This invite code has already been used");
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      throw new Error("This invite code has expired");
    }

    const assignedRole = code.code === "SAGIP-ADMIN-BOOTSTRAP" ? "super_admin" : "admin";

    // 2. Decode ID file.
    let fileBytes: Buffer;
    try {
      fileBytes = Buffer.from(data.idFileBase64, "base64");
    } catch {
      throw new Error("Invalid ID document upload");
    }
    if (fileBytes.length < 1024) throw new Error("ID document file appears to be empty");
    if (fileBytes.length > 5 * 1024 * 1024) throw new Error("ID document must be 5MB or smaller");

    // 3. Create the auth user (email auto-confirmed for admins).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        role: assignedRole,
        is_super_admin: assignedRole === "super_admin",
      },
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Failed to create administrator account");

    // 4. Upload ID to verification-ids bucket using service role.
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

    // 5. Insert profile with verified ID details and full personal info.
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
      is_verified: true,
    });
    if (profErr) {
      await supabaseAdmin.storage.from("verification-ids").remove([path]);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }

    // 6. Replace the auto-assigned 'citizen' role with the assigned admin/super_admin role(s).
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const rolesToInsert =
      assignedRole === "super_admin"
        ? [
            { user_id: userId, role: "admin" as const },
            { user_id: userId, role: "super_admin" as const },
          ]
        : [{ user_id: userId, role: "admin" as const }];
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert(rolesToInsert);
    if (roleErr) {
      await supabaseAdmin.storage.from("verification-ids").remove([path]);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleErr.message);
    }

    // 7. Mark invite code as used.
    await supabaseAdmin
      .from("admin_invite_codes")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", code.id);

    return { ok: true, userId };
  });

function makeCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let s = "SAGIP-ADMIN-";
  for (let i = 0; i < 12; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const generateAdminInviteCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        note: z.string().trim().max(200).optional(),
        expiresAt: z.string().datetime().optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Verify caller is super_admin
    const { data: isSuperAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin" as any,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isSuperAdmin) throw new Error("Only super administrators can generate invite codes");

    // Create code
    const code = makeCode();
    const { data: inserted, error } = await supabase
      .from("admin_invite_codes")
      .insert({
        code,
        created_by: context.userId,
        note: data.note || null,
        expires_at: data.expiresAt || null,
      })
      .select("id,code,created_at,expires_at,note,used_at")
      .single();
    if (error) throw new Error(error.message);
    return inserted;
  });

export const listAdminInviteCodes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;

    const { data: isSuperAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "super_admin" as any,
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!isSuperAdmin) throw new Error("Only super administrators can view invite codes");

    const { data, error } = await supabase
      .from("admin_invite_codes")
      .select("id,code,created_at,expires_at,note,used_at,used_by")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

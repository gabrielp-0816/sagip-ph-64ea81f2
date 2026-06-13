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

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  inviteCode: z.string().trim().min(4).max(80),
  idType: idTypeEnum,
  idNumber: z.string().trim().min(3).max(50),
  idFileName: z.string().trim().min(1).max(200),
  idFileMime: z.string().trim().min(1).max(100),
  // base64-encoded file bytes; cap at ~7MB encoded (~5MB raw)
  idFileBase64: z.string().min(10).max(7_500_000),
});

export const signUpAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Validate invite code.
    const { data: code, error: codeErr } = await supabaseAdmin
      .from("admin_invite_codes")
      .select("id, used_at, expires_at")
      .eq("code", data.inviteCode)
      .maybeSingle();
    if (codeErr) throw new Error(codeErr.message);
    if (!code) throw new Error("Invalid invite code");
    if (code.used_at) throw new Error("This invite code has already been used");
    if (code.expires_at && new Date(code.expires_at) < new Date()) {
      throw new Error("This invite code has expired");
    }

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
      user_metadata: { first_name: data.firstName, last_name: data.lastName, role: "admin" },
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Failed to create administrator account");

    // 4. Upload ID to verification-ids bucket using service role.
    const safeExt = (data.idFileName.split(".").pop() ?? "jpg").replace(/[^a-zA-Z0-9]/g, "").slice(0, 8) || "jpg";
    const path = `${userId}/id-${Date.now()}.${safeExt}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("verification-ids")
      .upload(path, fileBytes, { contentType: data.idFileMime, upsert: true });
    if (upErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`ID upload failed: ${upErr.message}`);
    }

    // 5. Insert profile with verified ID details.
    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
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

    // 6. Replace the auto-assigned 'citizen' role with 'admin'.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
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

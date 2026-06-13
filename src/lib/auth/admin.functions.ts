import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  inviteCode: z.string().trim().min(4).max(80),
});

export const signUpAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => signupSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Validate invite code (must exist, unused, not expired).
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

    // 2. Create the auth user (email auto-confirmed for admins).
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.firstName, last_name: data.lastName, role: "admin" },
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Failed to create administrator account");

    // 3. Create lightweight profile.
    const { error: profErr } = await supabaseAdmin.from("profiles").insert({
      id: userId,
      first_name: data.firstName,
      last_name: data.lastName,
      email: data.email,
      is_verified: true,
    });
    if (profErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(profErr.message);
    }

    // 4. Replace the auto-assigned 'citizen' role with 'admin'.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });
    if (roleErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(roleErr.message);
    }

    // 5. Mark the invite code as used.
    await supabaseAdmin
      .from("admin_invite_codes")
      .update({ used_at: new Date().toISOString(), used_by: userId })
      .eq("id", code.id);

    return { ok: true, userId };
  });

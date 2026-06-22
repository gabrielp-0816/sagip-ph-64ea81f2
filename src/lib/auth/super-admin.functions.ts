import { createServerFn } from "@tanstack/react-start";

const SUPER_ADMIN_EMAIL = "admin@sagip.local";
const SUPER_ADMIN_PASSWORD = "admin123";

/**
 * Idempotent seed of the built-in Super Admin account.
 * - Creates `admin@sagip.local` / `admin123` if it does not already exist.
 * - Grants the `admin` role.
 * - Safe to call repeatedly: no-ops when the account is present.
 *
 * This is intentionally public so the demo Super Admin is available without
 * any setup step. Credentials are well-known by design (see project request).
 */
export const ensureSuperAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Look for an existing user with this email
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);
  const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === SUPER_ADMIN_EMAIL);

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Force-update password and metadata to ensure correct default credentials/roles
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: SUPER_ADMIN_PASSWORD,
      user_metadata: {
        first_name: "Super",
        last_name: "Admin",
        role: "super_admin",
        is_super_admin: true,
      },
    });
    if (updateErr) throw new Error(updateErr.message);
  } else {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: SUPER_ADMIN_EMAIL,
      password: SUPER_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: {
        first_name: "Super",
        last_name: "Admin",
        role: "super_admin",
        is_super_admin: true,
      },
    });
    if (createErr) throw new Error(createErr.message);
    userId = created.user!.id;
  }

  // Ensure profile exists
  await supabaseAdmin.from("profiles").upsert({
    id: userId,
    first_name: "Super",
    last_name: "Admin",
    email: SUPER_ADMIN_EMAIL,
    mobile_number: "0000000000",
    birth_date: "1990-01-01",
    gender: "prefer_not_to_say",
    residential_address: "City Hall",
    city: "Manila",
    province: "Metro Manila",
    id_type: "national_id",
    id_number: "SUPER-ADMIN",
    id_document_path: "super-admin/system",
    is_verified: true,
  });

  // Ensure both admin and super_admin roles are present
  await supabaseAdmin.from("user_roles").upsert(
    [
      { user_id: userId, role: "admin" },
      { user_id: userId, role: "super_admin" },
    ],
    { onConflict: "user_id,role" },
  );

  return { ok: true, userId, email: SUPER_ADMIN_EMAIL };
});

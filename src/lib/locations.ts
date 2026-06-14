// 17 Local Government Units of Metro Manila (NCR)
export const METRO_MANILA_CITIES = [
  "Caloocan",
  "Las Piñas",
  "Makati",
  "Malabon",
  "Mandaluyong",
  "Manila",
  "Marikina",
  "Muntinlupa",
  "Navotas",
  "Parañaque",
  "Pasay",
  "Pasig",
  "Pateros",
  "Quezon City",
  "San Juan",
  "Taguig",
  "Valenzuela",
] as const;

// Strict email regex: disallows leading/trailing dots, double dots, special chars at boundaries.
// Rejects malformed addresses like "e6-@gmail.com" or ".user@x.com".
export const STRICT_EMAIL_REGEX =
  /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export function isValidEmail(email: string): boolean {
  if (!email || email.length > 254) return false;
  if (email.includes("..")) return false;
  // Local part must not end with - or .
  const at = email.indexOf("@");
  if (at < 1) return false;
  const local = email.slice(0, at);
  if (/[.\-]$/.test(local) || /^[.\-]/.test(local)) return false;
  return STRICT_EMAIL_REGEX.test(email);
}

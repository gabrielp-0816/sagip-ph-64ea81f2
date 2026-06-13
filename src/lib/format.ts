export function formatPHP(amount: number | string | null | undefined, options?: { compact?: boolean }) {
  const n = typeof amount === "string" ? Number(amount) : amount ?? 0;
  if (!isFinite(n)) return "₱0";
  if (options?.compact) {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

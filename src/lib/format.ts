// Deterministic formatters — must match between Node (SSR) and browser ICU.
function group(int: string) {
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatPHP(
  amount: number | string | null | undefined,
  options?: { compact?: boolean; decimals?: number },
) {
  const n = typeof amount === "string" ? Number(amount) : (amount ?? 0);
  if (!isFinite(n)) return "₱0";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);

  if (options?.compact) {
    const tiers: [number, string][] = [
      [1_000_000_000, "B"],
      [1_000_000, "M"],
      [1_000, "K"],
    ];
    for (const [div, suffix] of tiers) {
      if (abs >= div) {
        const v = abs / div;
        const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(1);
        return `${sign}₱${s.replace(/\.0$/, "")}${suffix}`;
      }
    }
    return `${sign}₱${Math.round(abs).toString()}`;
  }

  const decimals = options?.decimals ?? (Number.isInteger(abs) ? 0 : 2);
  const [intPart, decPart = ""] = abs.toFixed(decimals).split(".");
  return `${sign}₱${group(intPart)}${decPart ? "." + decPart : ""}`;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function formatDateTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()} · ${hh}:${mm} UTC`;
}

export function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(date);
}

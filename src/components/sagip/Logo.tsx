import { cn } from "@/lib/utils";

export function SagipLogo({
  className,
  variant = "dark",
}: {
  className?: string;
  variant?: "dark" | "light";
}) {
  const stroke = variant === "light" ? "oklch(0.98 0.005 95)" : "oklch(0.28 0.09 258)";
  const gold = "oklch(0.75 0.13 82)";
  const relief = "oklch(0.48 0.12 162)";
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 48 48" className="h-9 w-9" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="none" stroke={stroke} strokeWidth="2" />
        <circle cx="24" cy="24" r="16" fill="none" stroke={gold} strokeWidth="1" />
        {/* Stylized shield + sun rays */}
        <path
          d="M24 10 L34 14 V25 C34 31 29 35 24 37 C19 35 14 31 14 25 V14 Z"
          fill={stroke}
          opacity="0.95"
        />
        <path d="M24 18 V30 M19 24 H29" stroke={gold} strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="24" r="2.2" fill={relief} />
      </svg>
      <div className="leading-none">
        <div
          className={cn(
            "font-display text-xl font-semibold tracking-tight",
            variant === "light" ? "text-paper" : "text-ink",
          )}
        >
          SAGIP
        </div>
        <div
          className={cn(
            "text-[10px] font-medium uppercase tracking-[0.18em]",
            variant === "light" ? "text-paper/70" : "text-muted-foreground",
          )}
        >
          Disaster Risk Fund
        </div>
      </div>
    </div>
  );
}

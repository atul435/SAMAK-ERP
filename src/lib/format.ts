export function inr(value: number | null | undefined, compact = false): string {
  const n = Number(value ?? 0);
  if (compact) {
    if (Math.abs(n) >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  }
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function pct(value: number | null | undefined): string {
  return `${Math.round(Number(value ?? 0))}%`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function titleCase(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Display label for a permission module key. The "jarvis" module (the
 * permission key stored in role_permissions, unchanged for compatibility)
 * is branded "GrowIQ" everywhere a person actually sees it.
 */
export function moduleLabel(module: string | null | undefined): string {
  if (module === "jarvis") return "GrowIQ";
  return titleCase(module);
}

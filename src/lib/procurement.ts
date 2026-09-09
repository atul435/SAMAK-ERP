export type PoItemLike = {
  quantity: number | null;
  unit_rate: number | null;
  received_quantity?: number | null;
};

export type PoMarkups = {
  tax_percent: number | null;
  freight_amount: number | null;
};

export type PoTotals = {
  basic: number;
  freight: number;
  tax: number;
  grand: number;
  orderedQty: number;
  receivedQty: number;
  receivedPercent: number;
};

export function poLineAmount(item: PoItemLike): number {
  return Number(item.quantity ?? 0) * Number(item.unit_rate ?? 0);
}

export function poTotals(items: PoItemLike[], markups: PoMarkups): PoTotals {
  const basic = items.reduce((sum, i) => sum + poLineAmount(i), 0);
  const freight = Number(markups.freight_amount ?? 0);
  const tax = ((basic + freight) * Number(markups.tax_percent ?? 0)) / 100;
  const orderedQty = items.reduce((sum, i) => sum + Number(i.quantity ?? 0), 0);
  const receivedQty = items.reduce((sum, i) => sum + Number(i.received_quantity ?? 0), 0);
  return {
    basic,
    freight,
    tax,
    grand: basic + freight + tax,
    orderedQty,
    receivedQty,
    receivedPercent: orderedQty > 0 ? (receivedQty / orderedQty) * 100 : 0,
  };
}

export type MatchStatus = "ok" | "no_bill" | "over_billed" | "over_received";

export const MATCH_STATUS_TONE: Record<MatchStatus, "success" | "warning" | "danger" | "default"> =
  {
    ok: "success",
    no_bill: "default",
    over_received: "warning",
    over_billed: "danger",
  };

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  ok: "Matched",
  no_bill: "No bill yet",
  over_received: "Received exceeds order",
  over_billed: "Billed exceeds received",
};

export const PO_STATES = [
  "draft",
  "submitted",
  "pending_approval",
  "approved",
  "rejected",
  "executed",
  "cancelled",
] as const;

export const VENDOR_CATEGORIES = [
  "plants",
  "soil_media",
  "irrigation",
  "hardscape",
  "lighting",
  "labour",
  "equipment",
  "other",
] as const;

export const MOVEMENT_TYPES = ["receipt", "issue", "return", "transfer", "adjustment"] as const;

export type MovementLike = {
  movement_type: string | null;
  quantity: number | null;
  unit_rate: number | null;
  uom: string | null;
  description: string | null;
  material_id: string | null;
  species_id: string | null;
  store_id: string | null;
};

export type StockBalance = {
  key: string;
  label: string;
  uom: string;
  storeId: string | null;
  received: number;
  issued: number;
  onHand: number;
  value: number;
};

/** Inbound movements add to stock, outbound subtract. Adjustments are signed. */
export function movementSign(type: string | null): number {
  if (type === "issue" || type === "transfer") return -1;
  if (type === "adjustment") return 1; // quantity itself carries the sign
  return 1;
}

export function stockBalances<T extends MovementLike>(
  movements: T[],
  labelFor: (m: T) => string,
): StockBalance[] {
  const map = new Map<string, StockBalance>();
  for (const m of movements) {
    const itemKey = m.material_id ?? m.species_id ?? m.description ?? "unknown";
    const key = `${m.store_id ?? "none"}::${itemKey}`;
    const qty = Number(m.quantity ?? 0);
    const signed = qty * movementSign(m.movement_type);
    const current =
      map.get(key) ??
      ({
        key,
        label: labelFor(m),
        uom: m.uom ?? "nos",
        storeId: m.store_id,
        received: 0,
        issued: 0,
        onHand: 0,
        value: 0,
      } satisfies StockBalance);
    if (signed >= 0) current.received += Math.abs(signed);
    else current.issued += Math.abs(signed);
    current.onHand += signed;
    current.value += signed * Number(m.unit_rate ?? 0);
    map.set(key, current);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

export type BoqItemLike = {
  quantity: number | null;
  wastage_percent: number | null;
  unit_rate: number | null;
  item_kind: string | null;
  gst_percent?: number | null;
};

export type BoqMarkups = {
  overhead_percent: number | null;
  profit_percent: number | null;
  contingency_percent: number | null;
  tax_percent: number | null;
};

export function lineAmount(item: BoqItemLike): number {
  const qty = Number(item.quantity ?? 0);
  const wastage = Number(item.wastage_percent ?? 0);
  const rate = Number(item.unit_rate ?? 0);
  return qty * (1 + wastage / 100) * rate;
}

export function effectiveQuantity(item: BoqItemLike): number {
  return Number(item.quantity ?? 0) * (1 + Number(item.wastage_percent ?? 0) / 100);
}

export type BoqTotals = {
  direct: number;
  overhead: number;
  profit: number;
  contingency: number;
  preTax: number;
  tax: number;
  grand: number;
};

export function computeTotals(items: BoqItemLike[], markups: BoqMarkups): BoqTotals {
  const direct = items.reduce((sum, i) => sum + lineAmount(i), 0);
  const overhead = (direct * Number(markups.overhead_percent ?? 0)) / 100;
  const contingency = (direct * Number(markups.contingency_percent ?? 0)) / 100;
  const profit = ((direct + overhead + contingency) * Number(markups.profit_percent ?? 0)) / 100;
  const preTax = direct + overhead + contingency + profit;

  // Each line is taxed at its own GST rate (falling back to the BOQ's
  // blanket tax_percent for a line with no rate of its own -- old items, or
  // one added without one). Overhead/contingency/profit aren't tied to any
  // single item, so they're taxed at the direct-cost-weighted average rate:
  // exact when every item shares one rate (identical to the old flat-rate
  // formula), and a fair blend for a BOQ mixing low-GST plants with
  // higher-GST hardscape.
  const directTax = items.reduce((sum, i) => {
    const rate = i.gst_percent ?? markups.tax_percent ?? 0;
    return sum + lineAmount(i) * (Number(rate) / 100);
  }, 0);
  const effectiveRate = direct > 0 ? directTax / direct : Number(markups.tax_percent ?? 0) / 100;
  const markupTax = (overhead + contingency + profit) * effectiveRate;
  const tax = directTax + markupTax;

  return { direct, overhead, profit, contingency, preTax, tax, grand: preTax + tax };
}

export const ITEM_KINDS = ["plant", "material", "labour", "equipment", "other"] as const;

export function kindBreakdown(items: BoqItemLike[]): { kind: string; amount: number }[] {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = item.item_kind ?? "other";
    map.set(key, (map.get(key) ?? 0) + lineAmount(item));
  }
  return [...map.entries()]
    .map(([kind, amount]) => ({ kind, amount }))
    .sort((a, b) => b.amount - a.amount);
}

/** Site-measured execution against an estimate line, from the boq_item_execution view. */
export type ExecutionRow = {
  boq_item_id: string;
  quantity_done: number | null;
  executed_amount: number | null;
  percent_done: number | null;
  last_reported_on: string | null;
};

export function executionMap(rows: ExecutionRow[]): Map<string, ExecutionRow> {
  return new Map(rows.map((r) => [r.boq_item_id, r]));
}

/** Executed value, capped per line so an over-measurement cannot inflate the estimate. */
export function executedValue(items: BoqItemLike[], rows: ExecutionRow[]): number {
  const map = executionMap(rows);
  return items.reduce((sum, item, index) => {
    const row = map.get((item as { id?: string }).id ?? String(index));
    if (!row) return sum;
    return sum + Math.min(Number(row.executed_amount ?? 0), lineAmount(item));
  }, 0);
}

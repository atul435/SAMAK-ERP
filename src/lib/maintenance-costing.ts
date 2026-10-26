export interface CostingRow {
  revenue: number;
  visit_count: number;
  labour_hours: number;
  labour_cost: number | null;
  labour_withheld: boolean;
  material_cost: number;
  equipment_cost: number;
}

export interface RowCosting {
  totalCost: number | null;
  margin: number | null;
  marginPct: number | null;
}

/**
 * A contract whose labour is withheld (one person's hours — showing the
 * margin would reveal their pay) has no computable total cost or margin.
 */
export function rowCosting(r: CostingRow): RowCosting {
  if (r.labour_withheld || r.labour_cost == null) {
    return { totalCost: null, margin: null, marginPct: null };
  }
  const totalCost = r.labour_cost + r.material_cost + r.equipment_cost;
  const margin = r.revenue - totalCost;
  return { totalCost, margin, marginPct: r.revenue > 0 ? (margin / r.revenue) * 100 : null };
}

export interface CostingSummary {
  revenue: number;
  totalCost: number;
  margin: number;
  marginPct: number | null;
  withheldCount: number;
}

/**
 * Totals cover only contracts whose cost is fully known, so revenue, cost
 * and margin always describe the same set of contracts.
 */
export function summariseCosting(rows: CostingRow[]): CostingSummary {
  let revenue = 0;
  let totalCost = 0;
  let withheldCount = 0;
  for (const r of rows) {
    const c = rowCosting(r);
    if (c.totalCost == null) {
      withheldCount += 1;
      continue;
    }
    revenue += r.revenue;
    totalCost += c.totalCost;
  }
  const margin = revenue - totalCost;
  return {
    revenue,
    totalCost,
    margin,
    marginPct: revenue > 0 ? (margin / revenue) * 100 : null,
    withheldCount,
  };
}

import { describe, expect, it } from "vitest";
import { rowCosting, summariseCosting, type CostingRow } from "./maintenance-costing";

const base: CostingRow = {
  revenue: 50000,
  visit_count: 8,
  labour_hours: 64,
  labour_cost: 20000,
  labour_withheld: false,
  material_cost: 5000,
  equipment_cost: 1000,
};

describe("rowCosting", () => {
  it("adds labour, material and equipment and derives margin", () => {
    const c = rowCosting(base);
    expect(c.totalCost).toBe(26000);
    expect(c.margin).toBe(24000);
    expect(c.marginPct).toBeCloseTo(48);
  });

  it("returns nothing computable when labour is withheld", () => {
    const c = rowCosting({ ...base, labour_cost: null, labour_withheld: true });
    expect(c).toEqual({ totalCost: null, margin: null, marginPct: null });
  });

  it("reports a negative margin when costs exceed revenue", () => {
    const c = rowCosting({ ...base, revenue: 10000 });
    expect(c.margin).toBe(-16000);
    expect(c.marginPct).toBeCloseTo(-160);
  });

  it("has no margin percentage when there is no revenue", () => {
    const c = rowCosting({ ...base, revenue: 0 });
    expect(c.totalCost).toBe(26000);
    expect(c.marginPct).toBeNull();
  });
});

describe("summariseCosting", () => {
  it("sums only contracts whose cost is known and counts the withheld ones", () => {
    const rows: CostingRow[] = [
      base,
      { ...base, revenue: 30000, labour_cost: 10000, material_cost: 0, equipment_cost: 0 },
      { ...base, revenue: 99999, labour_cost: null, labour_withheld: true },
    ];
    const s = summariseCosting(rows);
    expect(s.revenue).toBe(80000);
    expect(s.totalCost).toBe(36000);
    expect(s.margin).toBe(44000);
    expect(s.marginPct).toBeCloseTo(55);
    expect(s.withheldCount).toBe(1);
  });

  it("is all zero for no rows", () => {
    const s = summariseCosting([]);
    expect(s).toEqual({ revenue: 0, totalCost: 0, margin: 0, marginPct: null, withheldCount: 0 });
  });
});

import { describe, expect, it } from "vitest";
import { computeTotals, effectiveQuantity, executedValue, kindBreakdown, lineAmount } from "./boq";

describe("lineAmount", () => {
  it("applies wastage before pricing", () => {
    // 100 units, 5% wastage -> 105 billable units at ₹200
    expect(
      lineAmount({ quantity: 100, wastage_percent: 5, unit_rate: 200, item_kind: "plant" }),
    ).toBe(21000);
  });

  it("treats missing fields as zero", () => {
    expect(
      lineAmount({ quantity: null, wastage_percent: null, unit_rate: null, item_kind: null }),
    ).toBe(0);
  });
});

describe("effectiveQuantity", () => {
  it("matches the quantity used inside lineAmount", () => {
    const item = { quantity: 40, wastage_percent: 10, unit_rate: 50, item_kind: "material" };
    expect(effectiveQuantity(item)).toBeCloseTo(44);
    expect(lineAmount(item)).toBeCloseTo(effectiveQuantity(item) * 50);
  });
});

describe("computeTotals", () => {
  it("layers overhead, contingency and profit before tax, matching a hand-worked estimate", () => {
    // Direct: (10 * 1.0 * 1000) + (5 * 1.0 * 2000) = 10,000 + 10,000 = 20,000
    const items = [
      { quantity: 10, wastage_percent: 0, unit_rate: 1000, item_kind: "material" },
      { quantity: 5, wastage_percent: 0, unit_rate: 2000, item_kind: "plant" },
    ];
    const totals = computeTotals(items, {
      overhead_percent: 10,
      contingency_percent: 5,
      profit_percent: 10,
      tax_percent: 18,
    });
    expect(totals.direct).toBe(20000);
    expect(totals.overhead).toBe(2000); // 10% of direct
    expect(totals.contingency).toBe(1000); // 5% of direct
    expect(totals.profit).toBeCloseTo(2300); // 10% of (20000+2000+1000)
    expect(totals.preTax).toBeCloseTo(25300);
    expect(totals.tax).toBeCloseTo(4554); // 18% of preTax
    expect(totals.grand).toBeCloseTo(29854);
  });

  it("returns all zeros for an empty estimate", () => {
    const totals = computeTotals([], {
      overhead_percent: 10,
      contingency_percent: 5,
      profit_percent: 10,
      tax_percent: 18,
    });
    expect(totals).toEqual({
      direct: 0,
      overhead: 0,
      profit: 0,
      contingency: 0,
      preTax: 0,
      tax: 0,
      grand: 0,
    });
  });
});

describe("kindBreakdown", () => {
  it("groups line value by item kind and sorts descending", () => {
    const items = [
      { quantity: 1, wastage_percent: 0, unit_rate: 500, item_kind: "labour" },
      { quantity: 2, wastage_percent: 0, unit_rate: 2000, item_kind: "plant" },
      { quantity: 1, wastage_percent: 0, unit_rate: 300, item_kind: "labour" },
    ];
    expect(kindBreakdown(items)).toEqual([
      { kind: "plant", amount: 4000 },
      { kind: "labour", amount: 800 },
    ]);
  });

  it("buckets a missing item_kind under 'other'", () => {
    const items = [{ quantity: 1, wastage_percent: 0, unit_rate: 100, item_kind: null }];
    expect(kindBreakdown(items)).toEqual([{ kind: "other", amount: 100 }]);
  });
});

describe("executedValue", () => {
  it("caps each line's executed value at what was actually estimated", () => {
    const items = [
      { id: "a", quantity: 10, wastage_percent: 0, unit_rate: 100, item_kind: "material" },
    ];
    // Site reported 150% progress on this line — must not inflate the estimate.
    const rows = [
      {
        boq_item_id: "a",
        quantity_done: 15,
        executed_amount: 1500,
        percent_done: 150,
        last_reported_on: null,
      },
    ];
    expect(executedValue(items, rows)).toBe(1000); // capped at lineAmount, not 1500
  });

  it("ignores estimate lines with no matching execution row", () => {
    const items = [
      { id: "a", quantity: 10, wastage_percent: 0, unit_rate: 100, item_kind: "material" },
    ];
    expect(executedValue(items, [])).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { calculateInstallationCost, type ProductivityActivity } from "./installation-cost";

const treeSmall: ProductivityActivity = {
  activity_code: "TREE-S",
  work_type: "Tree - small",
  size_spec: "1.5-2.5 m / 20-40 L",
  uom: "No.",
  typical_weight_kg: 35,
  direct_mh_per_unit: 1.72,
  supervisor_mh_per_unit: 0.08,
  machine_type: null,
  machine_hr_per_unit: 0,
  suggested_vehicle: "Pickup / 1.5T",
};

const rates = {
  working_hours_per_day: 8,
  general_labour_wage: 900,
  supervisor_wage: 1800,
  loading_labour_wage: 900,
  unloading_labour_wage: 900,
  tools_ppe_percent: 3,
  overhead_percent: 10,
  profit_percent: 10,
  gst_percent: 18,
  loading_waiting_hr: 0.5,
  unloading_waiting_hr: 0.75,
  traffic_factor: 1,
};

const vehicles = [
  {
    vehicle: "Pickup / 1.5T",
    payload_kg: 1500,
    base_rate_per_trip: 2200,
    rate_per_km: 30,
    minimum_rate: 2200,
  },
];

describe("calculateInstallationCost", () => {
  it("matches a hand-worked estimate for 10 small trees, 30km, normal access", () => {
    const result = calculateInstallationCost({
      activity: treeSmall,
      quantity: 10,
      distanceKm: 30,
      accessFactor: 1,
      rates,
      vehicles,
    });

    expect(result.directMh).toBeCloseTo(17.2);
    expect(result.supervisorMh).toBeCloseTo(0.8);
    expect(result.labourCost).toBeCloseTo(1935);
    expect(result.supervisorCost).toBeCloseTo(180);
    expect(result.machineCost).toBe(0);
    expect(result.trips).toBe(1);
    // base 2200 vs 2200 + 2*30km*30/km = 4000 -> transport uses the larger figure
    expect(result.transportCost).toBeCloseTo(4000);
    expect(result.waitingHandlingCost).toBeCloseTo(281.25);
    expect(result.toolsPpeCost).toBeCloseTo(63.45);
    // Direct cost is the sum of the six currency components only -- not a
    // blanket range sum like the source workbook's buggy SUM(M:Y), which
    // would have also swept in machine-hours/weight/payload/trip figures.
    expect(result.directCost).toBeCloseTo(6459.7);
    expect(result.overheadCost).toBeCloseTo(645.97);
    expect(result.profitCost).toBeCloseTo(710.567);
    expect(result.preGstCost).toBeCloseTo(7816.237);
    expect(result.gstCost).toBeCloseTo(1406.92266);
    expect(result.totalCost).toBeCloseTo(9223.15966);
    expect(result.costPerUnit).toBeCloseTo(922.315966);
  });

  it("does not add a machine cost for activities with no machine type", () => {
    const result = calculateInstallationCost({
      activity: treeSmall,
      quantity: 5,
      distanceKm: 10,
      accessFactor: 1,
      rates,
      vehicles,
    });
    expect(result.machineCost).toBe(0);
  });

  it("applies the access factor to both direct and supervisor man-hours", () => {
    const base = calculateInstallationCost({
      activity: treeSmall,
      quantity: 10,
      distanceKm: 30,
      accessFactor: 1,
      rates,
      vehicles,
    });
    const constrained = calculateInstallationCost({
      activity: treeSmall,
      quantity: 10,
      distanceKm: 30,
      accessFactor: 1.15,
      rates,
      vehicles,
    });
    expect(constrained.directMh).toBeCloseTo(base.directMh * 1.15);
    expect(constrained.supervisorMh).toBeCloseTo(base.supervisorMh * 1.15);
  });

  it("returns zero cost for zero quantity", () => {
    const result = calculateInstallationCost({
      activity: treeSmall,
      quantity: 0,
      distanceKm: 30,
      accessFactor: 1,
      rates,
      vehicles,
    });
    expect(result.trips).toBe(0);
    expect(result.totalCost).toBe(0);
    expect(result.costPerUnit).toBe(0);
  });
});

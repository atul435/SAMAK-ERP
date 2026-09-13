export interface ProductivityActivity {
  activity_code: string;
  work_type: string;
  size_spec: string | null;
  uom: string;
  typical_weight_kg: number | null;
  direct_mh_per_unit: number;
  supervisor_mh_per_unit: number;
  machine_type: string | null;
  machine_hr_per_unit: number | null;
  suggested_vehicle: string | null;
}

export interface VehicleRate {
  vehicle: string;
  payload_kg: number;
  base_rate_per_trip: number;
  rate_per_km: number;
  minimum_rate: number;
}

export type CostRates = Record<string, number>;

export interface InstallationCostInput {
  activity: ProductivityActivity;
  quantity: number;
  distanceKm: number;
  accessFactor: number;
  rates: CostRates;
  vehicles: VehicleRate[];
}

export interface InstallationCostResult {
  directMh: number;
  supervisorMh: number;
  labourCost: number;
  supervisorCost: number;
  machineCost: number;
  trips: number;
  transportCost: number;
  waitingHandlingCost: number;
  toolsPpeCost: number;
  directCost: number;
  overheadCost: number;
  profitCost: number;
  preGstCost: number;
  gstCost: number;
  totalCost: number;
  costPerUnit: number;
}

const MACHINE_RATE_KEY: Record<string, string> = {
  "Mini excavator/JCB": "jcb_rate",
  "Crane / Hydra small": "crane_small_rate",
  "Crane / Hydra large": "crane_large_rate",
};

/**
 * Ports Samak's Landscape Labour & Logistics Cost Master workbook's
 * Project_Cost_Estimator formulas. One correction versus the workbook:
 * its "Direct Cost" cell was `=SUM(M:Y)` across a range that also swept up
 * the (non-currency) machine-hours, unit/total weight, payload and trip
 * count columns sitting between the real cost columns -- inflating direct
 * cost by those raw numbers for any heavy item. Direct cost here is the
 * explicit sum of the six actual currency components instead.
 */
export function calculateInstallationCost({
  activity,
  quantity,
  distanceKm,
  accessFactor,
  rates,
  vehicles,
}: InstallationCostInput): InstallationCostResult {
  const hoursPerDay = rates["working_hours_per_day"] || 8;
  const qty = Math.max(0, quantity);

  const directMh = qty * activity.direct_mh_per_unit * accessFactor;
  const supervisorMh = qty * activity.supervisor_mh_per_unit * accessFactor;

  const labourCost = directMh * ((rates["general_labour_wage"] || 0) / hoursPerDay);
  const supervisorCost = supervisorMh * ((rates["supervisor_wage"] || 0) / hoursPerDay);

  const machineRateKey = activity.machine_type ? MACHINE_RATE_KEY[activity.machine_type] : null;
  const machineCost = machineRateKey
    ? qty * (activity.machine_hr_per_unit ?? 0) * ((rates[machineRateKey] || 0) / hoursPerDay)
    : 0;

  const unitWeight = activity.typical_weight_kg ?? 0;
  const totalWeight = qty * unitWeight;
  const vehicle = activity.suggested_vehicle
    ? vehicles.find((v) => v.vehicle === activity.suggested_vehicle)
    : undefined;
  const payload = vehicle?.payload_kg ?? 0;
  const trips =
    qty <= 0 ? 0 : totalWeight === 0 || payload === 0 ? 1 : Math.ceil(totalWeight / payload);

  const trafficFactor = rates["traffic_factor"] || 1;
  const transportCost =
    trips === 0 || !vehicle
      ? 0
      : trips *
        Math.max(
          vehicle.minimum_rate,
          vehicle.base_rate_per_trip + 2 * distanceKm * vehicle.rate_per_km * trafficFactor,
        );

  const waitingHandlingCost =
    trips *
    ((rates["loading_waiting_hr"] || 0) + (rates["unloading_waiting_hr"] || 0)) *
    2 *
    ((rates["loading_labour_wage"] || 0) / hoursPerDay);

  const toolsPpeCost = (labourCost + supervisorCost) * ((rates["tools_ppe_percent"] || 0) / 100);

  const directCost =
    labourCost + supervisorCost + machineCost + transportCost + waitingHandlingCost + toolsPpeCost;

  const overheadCost = directCost * ((rates["overhead_percent"] || 0) / 100);
  const profitCost = (directCost + overheadCost) * ((rates["profit_percent"] || 0) / 100);
  const preGstCost = directCost + overheadCost + profitCost;
  const gstCost = preGstCost * ((rates["gst_percent"] || 0) / 100);
  const totalCost = preGstCost + gstCost;
  const costPerUnit = qty > 0 ? totalCost / qty : 0;

  return {
    directMh,
    supervisorMh,
    labourCost,
    supervisorCost,
    machineCost,
    trips,
    transportCost,
    waitingHandlingCost,
    toolsPpeCost,
    directCost,
    overheadCost,
    profitCost,
    preGstCost,
    gstCost,
    totalCost,
    costPerUnit,
  };
}

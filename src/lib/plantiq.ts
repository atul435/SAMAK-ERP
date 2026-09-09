export const HEALTH_GRADES = ["good", "fair", "poor"] as const;

export const CARE_TASK_TYPES = [
  "watering",
  "feeding",
  "pruning",
  "mowing",
  "pest_watch",
  "staking",
  "mulching",
] as const;

export const CARE_SEASONS = ["all_year", "summer", "monsoon", "winter"] as const;

export const CHECK_SEVERITIES = ["low", "medium", "high"] as const;

export type BatchLike = {
  id: string;
  quantity_received: number | null;
  quantity_mortality: number | null;
  unit_cost: number | null;
};

export type PlantingLike = {
  batch_id: string;
  quantity: number | null;
};

/** Plants still standing in the nursery/holding yard for a batch. */
export function batchAvailable(batch: BatchLike, plantings: PlantingLike[]): number {
  const planted = plantings
    .filter((p) => p.batch_id === batch.id)
    .reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
  return Number(batch.quantity_received ?? 0) - Number(batch.quantity_mortality ?? 0) - planted;
}

export function batchPlanted(batchId: string, plantings: PlantingLike[]): number {
  return plantings
    .filter((p) => p.batch_id === batchId)
    .reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
}

export function batchValue(batch: BatchLike, plantings: PlantingLike[]): number {
  return batchAvailable(batch, plantings) * Number(batch.unit_cost ?? 0);
}

export function mortalityPercent(batches: BatchLike[]): number {
  const received = batches.reduce((s, b) => s + Number(b.quantity_received ?? 0), 0);
  const dead = batches.reduce((s, b) => s + Number(b.quantity_mortality ?? 0), 0);
  return received > 0 ? (dead / received) * 100 : 0;
}

export type DemandRow = {
  boqItemId: string;
  description: string;
  speciesId: string | null;
  uom: string;
  required: number;
  inNursery: number;
  planted: number;
  shortfall: number;
  coverPercent: number;
};

export function survivalPercent(sample: number | null, healthy: number | null): number {
  const s = Number(sample ?? 0);
  return s > 0 ? (Number(healthy ?? 0) / s) * 100 : 100;
}

/** Compare what an estimate priced against what the nursery holds and what is planted. */
export function demandCoverage(
  boqItems: {
    id: string;
    description: string;
    species_id: string | null;
    uom: string;
    quantity: number | null;
  }[],
  batches: (BatchLike & { boq_item_id: string | null })[],
  plantings: (PlantingLike & { boq_item_id: string | null })[],
): DemandRow[] {
  return boqItems.map((item) => {
    const itemBatches = batches.filter((b) => b.boq_item_id === item.id);
    const inNursery = itemBatches.reduce((s, b) => s + batchAvailable(b, plantings), 0);
    const planted = plantings
      .filter((p) => p.boq_item_id === item.id)
      .reduce((s, p) => s + Number(p.quantity ?? 0), 0);
    const required = Number(item.quantity ?? 0);
    const covered = inNursery + planted;
    return {
      boqItemId: item.id,
      description: item.description,
      speciesId: item.species_id,
      uom: item.uom,
      required,
      inNursery,
      planted,
      shortfall: Math.max(required - covered, 0),
      coverPercent: required > 0 ? (covered / required) * 100 : 0,
    };
  });
}

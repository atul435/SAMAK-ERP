export const WEATHER_OPTIONS = [
  "clear",
  "cloudy",
  "hot",
  "light_rain",
  "heavy_rain",
  "windy",
] as const;

export const PHOTO_CATEGORIES = [
  "progress",
  "quality",
  "safety",
  "issue",
  "material",
] as const;

export const LABOUR_TRADES = [
  "Gardener / mali",
  "Skilled mason",
  "Irrigation fitter",
  "Electrician",
  "Carpenter",
  "Helper",
  "Machine operator",
] as const;

export type AttendanceLike = {
  headcount_planned: number | null;
  headcount_present: number | null;
  hours_worked: number | null;
  day_rate: number | null;
};

export type AttendanceTotals = {
  planned: number;
  present: number;
  absent: number;
  manDays: number;
  cost: number;
  fulfilment: number;
};

/** A man-day is the hours actually worked against a nominal 8-hour day. */
export function attendanceTotals(rows: AttendanceLike[]): AttendanceTotals {
  let planned = 0;
  let present = 0;
  let manDays = 0;
  let cost = 0;
  for (const r of rows) {
    const p = Number(r.headcount_planned ?? 0);
    const a = Number(r.headcount_present ?? 0);
    const hours = Number(r.hours_worked ?? 8);
    planned += p;
    present += a;
    manDays += (a * hours) / 8;
    cost += ((a * hours) / 8) * Number(r.day_rate ?? 0);
  }
  return {
    planned,
    present,
    absent: Math.max(0, planned - present),
    manDays,
    cost,
    fulfilment: planned > 0 ? (present / planned) * 100 : 0,
  };
}

export type WorkLineLike = { quantity_planned: number | null; quantity_done: number | null };

export function workProgress(lines: WorkLineLike[]): number {
  const planned = lines.reduce((s, l) => s + Number(l.quantity_planned ?? 0), 0);
  const done = lines.reduce((s, l) => s + Number(l.quantity_done ?? 0), 0);
  return planned > 0 ? (done / planned) * 100 : 0;
}

export function formatCoords(lat: number | null, lng: number | null): string {
  if (lat == null || lng == null) return "No location captured";
  return `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
}

export function mapsLink(lat: number | null, lng: number | null): string | null {
  if (lat == null || lng == null) return null;
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export type Coords = { latitude: number; longitude: number; accuracy: number };

export function captureLocation(): Promise<Coords> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("This device cannot share its location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Location permission was refused.")),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  });
}

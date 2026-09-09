export const TENDER_KEYWORDS = [
  "horticulture",
  "landscaping",
  "plantation",
  "plant supply",
  "indoor plants",
  "vertical garden",
  "garden maintenance",
  "arboriculture",
  "topsoil",
  "nursery supply",
] as const;

export const TENDER_STATES = [
  "new",
  "reviewing",
  "bidding",
  "submitted",
  "won",
  "lost",
  "ignored",
] as const;

export type TenderStatus = (typeof TENDER_STATES)[number];

export type TenderRow = {
  id: string;
  tender_ref: string;
  organisation: string;
  title: string;
  description: string | null;
  keyword_matched: string | null;
  published_on: string | null;
  closing_on: string | null;
  estimated_value: number | null;
  location: string | null;
  state: string | null;
  source_name: string | null;
  source_url: string | null;
  status: string;
  is_starred: boolean;
  notes: string | null;
  project_id?: string | null;
  projects?: { project_code: string; name: string } | null;
};

/** Days left before submission closes; negative once the date has passed. */
export function daysToClose(closing: string | null): number | null {
  if (!closing) return null;
  const end = new Date(`${closing}T00:00:00`);
  if (Number.isNaN(end.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((end.getTime() - today.getTime()) / 86400000);
}

export function matchKeyword(text: string): string | null {
  const haystack = text.toLowerCase();
  return TENDER_KEYWORDS.find((k) => haystack.includes(k)) ?? null;
}

/** Minimal CSV parser handling quoted fields, for the scraper's CSV export. */
export function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const text = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

export function toIsoDate(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`;
  }
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function toNumber(value: string): number | null {
  const cleaned = value.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway } from "@/lib/jarvis.server";

const searchSchema = z.object({
  query: z.string().min(3).max(400),
});

export interface PlantExplorerMatch {
  id: string;
  reason: string;
}

export interface PlantExplorerResult {
  matches: PlantExplorerMatch[];
  summary: string;
}

/**
 * Turns a plain-English brief ("20 shade-loving low-maintenance plants for a
 * dry courtyard") into a ranked shortlist from the real plant master. Reads
 * go through the caller's own RLS-scoped client; plant_species is readable
 * by every authenticated employee, so this is available company-wide.
 */
export const searchPlantExplorer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => searchSchema.parse(input))
  .handler(async ({ data, context }): Promise<PlantExplorerResult> => {
    const { data: species, error } = await context.supabase
      .from("plant_species")
      .select(
        "id, common_name, botanical_name, category, subcategory, water_need, sunlight, maintenance_level, growth_rate, mature_height_m, mature_spread_m, drought_tolerance, heat_tolerance, frost_tolerance, pollution_tolerance, salinity_tolerance, landscape_uses, ai_design_tags, flower_colour, native_status, samak_preferred, indicative_sell_price, indicative_buy_price",
      );
    if (error) throw error;

    const system = `You are GrowIQ's plant-selection assistant for Samak Landscape, an Indian landscaping company. A designer or business-development staff member describes what they need in plain English (e.g. "20 shade-loving low-maintenance plants for a dry courtyard"). You are given the full plant master catalogue as JSON. Select the best-matching species, ranked most-relevant first.

STRICT RULES:
- Only select species that actually appear in the supplied catalogue, referenced by their exact "id" field.
- If the request specifies a count (e.g. "20 plants"), return exactly that many when the catalogue has enough reasonable matches; otherwise return fewer and say so in the summary.
- Prefer fewer, well-justified matches over padding the count with weak fits.
- Never invent species, ids or attributes not present in the data.

Respond as strict JSON with keys:
matches (array of { id: string, reason: string } -- reason is one short phrase, e.g. "full shade, low maintenance, drought tolerant"),
summary (string, one sentence on what was selected and any gaps in the brief).`;

    const parsed = await callGateway(
      system,
      `REQUEST: ${data.query}\n\nPLANT CATALOGUE:\n${JSON.stringify(species)}`,
      // A shortlist of up to 60 matches plus reasons, on top of whatever
      // the model spends on its own reasoning before answering, needs far
      // more headroom than GrowIQ's other, shorter-answer calls. Unused
      // budget costs nothing, so this errs generous against large asks.
      7000,
    );

    const matches = Array.isArray(parsed["matches"])
      ? (parsed["matches"] as unknown[])
          .map((raw) => {
            const m = (raw ?? {}) as Record<string, unknown>;
            return { id: String(m["id"] ?? ""), reason: String(m["reason"] ?? "") };
          })
          .filter((m) => m.id)
          .slice(0, 60)
      : [];

    return {
      matches,
      summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "",
    };
  });

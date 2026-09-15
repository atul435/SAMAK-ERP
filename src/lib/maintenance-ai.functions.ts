import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callGateway, type JarvisClient } from "@/lib/jarvis.server";

const draftSchema = z.object({ inspectionId: z.string().uuid() });

export interface InspectionSummaryDraft {
  summary: string;
  recommendedActions: string[];
}

/**
 * Drafts a client-facing summary of one inspection from its logged findings.
 * Reads go through the caller's own RLS-scoped client, so this can only ever
 * see an inspection the signed-in user is already permitted to open. The
 * model may not invent a finding — it drafts prose from what was logged and
 * nothing else. Staff review and edit the draft before it is saved.
 */
export const draftInspectionSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => draftSchema.parse(input))
  .handler(async ({ data, context }): Promise<InspectionSummaryDraft> => {
    const supabase = context.supabase as unknown as JarvisClient;

    const { data: inspection, error } = await supabase
      .from("maintenance_inspections")
      .select(
        "id, inspection_date, overall_score, maintenance_sites(name), inspection_findings(category, severity, affected_area_or_count, probable_cause, notes)",
      )
      .eq("id", data.inspectionId)
      .single();
    if (error) throw new Error(error.message);
    if (!inspection) throw new Error("Inspection not found.");

    const findings = inspection.inspection_findings ?? [];
    if (findings.length === 0)
      throw new Error("Add at least one finding before drafting a summary.");

    const system = `You are drafting a client-facing landscape inspection summary for Samak Landscape (India).

STRICT RULES:
- Use ONLY the findings supplied below. Never invent a finding, plant, pest, location or severity not present in the data.
- Professional, concise, non-alarmist tone suitable to send directly to the client as-is.
- Explicitly call out anything of high or critical severity.
- Respond as strict JSON: { "summary": "<120-160 word paragraph>", "recommendedActions": ["<action>", ...] } — at most 5 actions, each under 20 words, each grounded in a specific finding.`;

    const parsed = await callGateway(
      system,
      `SITE: ${inspection.maintenance_sites?.name ?? "Unknown site"}\nDATE: ${inspection.inspection_date}\nOVERALL SCORE: ${inspection.overall_score ?? "not scored"}\nFINDINGS:\n${JSON.stringify(findings)}`,
      1024,
    );

    const result: InspectionSummaryDraft = {
      summary: typeof parsed["summary"] === "string" ? parsed["summary"] : "",
      recommendedActions: Array.isArray(parsed["recommendedActions"])
        ? (parsed["recommendedActions"] as unknown[]).map(String).slice(0, 5)
        : [],
    };
    if (!result.summary) throw new Error("GrowIQ could not draft a summary — try again.");

    const employee = await supabase.from("employees").select("company_id").maybeSingle();
    await supabase.from("ai_interactions").insert({
      company_id: employee.data?.company_id ?? null,
      user_id: context.userId,
      question: `Draft inspection summary — ${inspection.id}`,
      answer: result.summary,
      context: {
        page: "/maintenance/inspections",
        kind: "inspection_summary",
        inspectionId: inspection.id,
      },
      confidence: 0.7,
      action_taken: "recommendation_only",
    });

    return result;
  });

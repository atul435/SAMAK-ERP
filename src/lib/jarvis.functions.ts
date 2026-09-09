import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { buildSnapshot, callGateway, JARVIS_RULES, type JarvisClient } from "@/lib/jarvis.server";
import type { JarvisDecision } from "@/lib/jarvis-decisions";

const askSchema = z.object({
  question: z.string().min(2).max(1000),
  page: z.string().optional(),
  history: z
    .array(z.object({ question: z.string().max(1000), answer: z.string().max(4000) }))
    .max(6)
    .optional(),
});

export interface JarvisAnswer {
  answer: string;
  evidence: string[];
  sources: string[];
  confidence: number;
  recommendedAction: string;
  actionLink?: string;
  requiresApproval: boolean;
}

export interface JarvisBriefingItem {
  title: string;
  detail: string;
  severity: "low" | "medium" | "high";
  sources: string[];
  link?: string;
}

export interface JarvisBriefing {
  headline: string;
  priorities: JarvisBriefingItem[];
  risks: JarvisBriefingItem[];
  opportunities: JarvisBriefingItem[];
  generatedAt: string;
}

const SEVERITIES = new Set(["low", "medium", "high"]);

function toItems(value: unknown): JarvisBriefingItem[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).map((raw) => {
    const item = (raw ?? {}) as Record<string, unknown>;
    const severity = String(item["severity"] ?? "medium");
    return {
      title: String(item["title"] ?? "Untitled"),
      detail: String(item["detail"] ?? ""),
      severity: (SEVERITIES.has(severity) ? severity : "medium") as JarvisBriefingItem["severity"],
      sources: Array.isArray(item["sources"]) ? (item["sources"] as unknown[]).map(String).slice(0, 6) : [],
      ...(typeof item["link"] === "string" && item["link"].startsWith("/") ? { link: item["link"] } : {}),
    };
  });
}

/**
 * JARVIS query. Reads go through the caller's own RLS-scoped client, so the
 * assistant can never see data the signed-in user cannot see, and it never
 * invents figures: the model only receives real ERP rows.
 */
export const askJarvis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => askSchema.parse(input))
  .handler(async ({ data, context }): Promise<JarvisAnswer> => {
    const supabase = context.supabase as unknown as JarvisClient;
    const snapshot = await buildSnapshot(supabase, data.page ?? null);

    const system = `${JARVIS_RULES}

Respond as strict JSON with keys:
answer (string, concise executive prose, max 130 words),
evidence (array of short factual bullet strings drawn from the data),
sources (array of record codes used, e.g. "PRJ-0003", "APR-0001"),
confidence (0-1 number),
recommendedAction (string, one concrete next step),
actionLink (optional app path such as "/approvals", "/finance", "/procurement", "/site"),
requiresApproval (boolean — true if the recommended action is a sensitive action needing human approval).`;

    const conversation = (data.history ?? [])
      .map((turn) => `Q: ${turn.question}\nA: ${turn.answer}`)
      .join("\n\n");

    const parsed = await callGateway(
      system,
      `${conversation ? `EARLIER IN THIS CONVERSATION:\n${conversation}\n\n` : ""}QUESTION: ${data.question}\n\nERP SNAPSHOT (authorised for this user only):\n${JSON.stringify(snapshot)}`,
    );

    const link = parsed["actionLink"];
    const result: JarvisAnswer = {
      answer: typeof parsed["answer"] === "string" ? parsed["answer"] : "No answer produced.",
      evidence: Array.isArray(parsed["evidence"])
        ? (parsed["evidence"] as unknown[]).map(String).slice(0, 8)
        : [],
      sources: Array.isArray(parsed["sources"])
        ? (parsed["sources"] as unknown[]).map(String).slice(0, 12)
        : [],
      confidence: typeof parsed["confidence"] === "number" ? parsed["confidence"] : 0.6,
      recommendedAction:
        typeof parsed["recommendedAction"] === "string"
          ? parsed["recommendedAction"]
          : "Review the linked records.",
      ...(typeof link === "string" && link.startsWith("/") ? { actionLink: link } : {}),
      requiresApproval: Boolean(parsed["requiresApproval"]),
    };

    await supabase.from("ai_interactions").insert({
      company_id: snapshot.companyId,
      user_id: context.userId,
      question: data.question,
      answer: result.answer,
      context: { page: data.page ?? null, sources: result.sources },
      confidence: result.confidence,
      action_taken: "recommendation_only",
    });

    return result;
  });

/**
 * Daily executive briefing generated from the same RLS-scoped snapshot.
 */
export const jarvisBriefing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<JarvisBriefing> => {
    const supabase = context.supabase as unknown as JarvisClient;
    const snapshot = await buildSnapshot(supabase, "/jarvis");

    const system = `${JARVIS_RULES}

Produce today's executive briefing for this user, tailored to their role.
Respond as strict JSON with keys:
headline (string, one sentence stating the single most important thing today),
priorities (array of up to 4 items — decisions or approvals that need action now),
risks (array of up to 4 items — cost overruns, overdue collections, delayed sites, stock shortfalls),
opportunities (array of up to 3 items — leads, opportunities, billing that can be raised).
Each item: { title, detail (max 40 words), severity ("low"|"medium"|"high"), sources (array of record codes), link (optional app path) }.
Every item must be grounded in a real record from the snapshot. If a section has no grounded item, return an empty array.`;

    const parsed = await callGateway(
      system,
      `ERP SNAPSHOT (authorised for this user only):\n${JSON.stringify(snapshot)}`,
    );

    const briefing: JarvisBriefing = {
      headline:
        typeof parsed["headline"] === "string" ? parsed["headline"] : "No briefing could be produced.",
      priorities: toItems(parsed["priorities"]),
      risks: toItems(parsed["risks"]),
      opportunities: toItems(parsed["opportunities"]),
      generatedAt: snapshot.generatedAt,
    };

    await supabase.from("ai_interactions").insert({
      company_id: snapshot.companyId,
      user_id: context.userId,
      question: "Daily executive briefing",
      answer: briefing.headline,
      context: { page: "/jarvis", kind: "briefing" },
      confidence: 0.7,
      action_taken: "recommendation_only",
    });

    return briefing;
  });


/**
 * Decision suggestions: overdue collections and late deliveries, computed
 * deterministically from real rows and pre-linked to the exact bill, receipt
 * or order page. JARVIS may only rephrase the suggested next step — never the
 * amounts, codes or links — and it never acts on them itself.
 */
export const jarvisDecisions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ decisions: JarvisDecision[]; generatedAt: string }> => {
    const supabase = context.supabase as unknown as JarvisClient;
    const snapshot = await buildSnapshot(supabase, "/jarvis");
    const decisions = snapshot.decisions as JarvisDecision[];
    if (!decisions.length) return { decisions, generatedAt: snapshot.generatedAt };

    try {
      const parsed = await callGateway(
        `${JARVIS_RULES}

You are rewriting the "suggestion" line of pre-computed decision cards so they read as a crisp instruction to a landscape-contracting executive.
Rules: keep every amount, record code, client and supplier name exactly as given; do not merge, drop or add cards; max 35 words each; no promises that anything has been done.
Respond as strict JSON: { "suggestions": [ { "id": "<card id verbatim>", "suggestion": "<rewritten line>" } ] }.`,
        `DECISION CARDS:\n${JSON.stringify(
          decisions.map((d) => ({
            id: d.id,
            kind: d.kind,
            title: d.title,
            detail: d.detail,
            suggestion: d.suggestion,
          })),
        )}`,
      );
      const list = Array.isArray(parsed["suggestions"]) ? (parsed["suggestions"] as unknown[]) : [];
      const byId = new Map<string, string>();
      for (const raw of list) {
        const row = (raw ?? {}) as Record<string, unknown>;
        const id = typeof row["id"] === "string" ? row["id"] : null;
        const text = typeof row["suggestion"] === "string" ? row["suggestion"].trim() : "";
        if (id && text) byId.set(id, text);
      }
      for (const d of decisions) {
        const better = byId.get(d.id);
        if (better) d.suggestion = better;
      }
    } catch (error) {
      // Wording help is optional — the grounded card stands on its own.
      console.error("JARVIS decision rewrite failed", error);
    }

    await supabase.from("ai_interactions").insert({
      company_id: snapshot.companyId,
      user_id: context.userId,
      question: "Decision suggestions",
      answer: decisions.map((d) => d.title).join(" | ").slice(0, 2000),
      context: { page: "/jarvis", kind: "decisions", ids: decisions.map((d) => d.id) },
      confidence: 0.9,
      action_taken: "recommendation_only",
    });

    return { decisions, generatedAt: snapshot.generatedAt };
  });

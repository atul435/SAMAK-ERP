import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { COMPANY_ID } from "@/lib/company";

const tenderSchema = z.object({
  tender_ref: z.string().trim().min(1).max(200),
  organisation: z.string().trim().min(1).max(300),
  title: z.string().trim().min(1).max(2000),
  description: z.string().trim().max(8000).optional().nullable(),
  keyword_matched: z.string().trim().max(200).optional().nullable(),
  published_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  closing_on: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  estimated_value: z.number().nonnegative().max(1e13).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  state: z.string().trim().max(120).optional().nullable(),
  source_name: z.string().trim().max(200).optional().nullable(),
  source_url: z.string().trim().url().max(2000).optional().nullable(),
});

const payloadSchema = z.object({
  tenders: z.array(tenderSchema).min(1).max(500),
});

export const Route = createFileRoute("/api/public/tenders-ingest")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["TENDER_INGEST_TOKEN"];
        if (!token) {
          return Response.json({ error: "Ingest is not configured" }, { status: 503 });
        }
        const header = request.headers.get("x-ingest-token") ?? "";
        if (header.length !== token.length || header !== token) {
          return Response.json({ error: "Invalid ingest token" }, { status: 401 });
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return Response.json({ error: "Body must be JSON" }, { status: 400 });
        }

        const parsed = payloadSchema.safeParse(body);
        if (!parsed.success) {
          return Response.json(
            { error: "Invalid payload", details: parsed.error.issues.slice(0, 10) },
            { status: 400 },
          );
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const refs = parsed.data.tenders.map((t) => t.tender_ref);
        const { data: existing, error: readError } = await supabaseAdmin
          .from("tenders")
          .select("id, tender_ref")
          .eq("company_id", COMPANY_ID)
          .in("tender_ref", refs);
        if (readError) {
          return Response.json({ error: readError.message }, { status: 500 });
        }

        const byRef = new Map(
          (existing ?? []).map((row) => [row.tender_ref.toLowerCase(), row.id]),
        );

        let inserted = 0;
        let updated = 0;
        const failures: string[] = [];

        for (const tender of parsed.data.tenders) {
          const values = {
            company_id: COMPANY_ID,
            tender_ref: tender.tender_ref,
            organisation: tender.organisation,
            title: tender.title,
            description: tender.description ?? null,
            keyword_matched: tender.keyword_matched ?? null,
            published_on: tender.published_on ?? null,
            closing_on: tender.closing_on ?? null,
            estimated_value: tender.estimated_value ?? null,
            location: tender.location ?? null,
            state: tender.state ?? null,
            source_name: tender.source_name ?? null,
            source_url: tender.source_url ?? null,
          };
          const id = byRef.get(tender.tender_ref.toLowerCase());
          if (id) {
            const { error } = await supabaseAdmin.from("tenders").update(values).eq("id", id);
            if (error) failures.push(`${tender.tender_ref}: ${error.message}`);
            else updated += 1;
          } else {
            const { error } = await supabaseAdmin.from("tenders").insert(values);
            if (error) failures.push(`${tender.tender_ref}: ${error.message}`);
            else inserted += 1;
          }
        }

        return Response.json({
          received: parsed.data.tenders.length,
          inserted,
          updated,
          failed: failures.length,
          errors: failures.slice(0, 5),
        });
      },
    },
  },
});

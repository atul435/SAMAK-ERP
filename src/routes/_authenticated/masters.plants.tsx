import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/masters/plants")({
  head: () => ({
    meta: [
      { title: "Plant palette — EnvironIQ PlantIQ" },
      {
        name: "description",
        content:
          "Samak's plant-intelligence backbone: botanical identity, growing requirements, tolerance ratings, regional fit and design tags for Indian landscapes.",
      },
      { property: "og:title", content: "Plant palette — EnvironIQ" },
      {
        property: "og:description",
        content: "Species master with habit, water need, maintenance level and nursery rate.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlantsPage,
});

const TOLERANCE_FIELDS = [
  ["drought_tolerance", "Drought"],
  ["heat_tolerance", "Heat"],
  ["frost_tolerance", "Frost"],
  ["pollution_tolerance", "Pollution"],
  ["salinity_tolerance", "Salinity"],
] as const;

const REGION_FIELDS = [
  ["delhi_ncr_fit", "Delhi NCR"],
  ["arid_nw_fit", "Arid NW"],
  ["himalayan_foothills_fit", "Himalayan foothills"],
  ["temperate_hills_fit", "Temperate hills"],
  ["western_coast_fit", "Western coast"],
  ["deccan_plateau_fit", "Deccan plateau"],
  ["east_ne_humid_fit", "East & NE humid"],
  ["coastal_south_fit", "Coastal south"],
] as const;

function PlantsPage() {
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["plant_species"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_species")
        .select(
          "id, plant_code, botanical_name, common_name, local_name, family, category, subcategory, native_status, sunlight, water_need, maintenance_level, mature_height_m, mature_spread_m, native_region, notes, ai_design_tags, samak_preferred, samak_field_rating, drought_tolerance, heat_tolerance, frost_tolerance, pollution_tolerance, salinity_tolerance, delhi_ncr_fit, arid_nw_fit, himalayan_foothills_fit, temperate_hills_fit, western_coast_fit, deccan_plateau_fit, east_ne_humid_fit, coastal_south_fit",
        )
        .order("botanical_name");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const t = term.trim().toLowerCase();
  const rows = (query.data ?? []).filter((p) =>
    `${p.botanical_name} ${p.common_name ?? ""} ${p.local_name ?? ""} ${p.family ?? ""} ${p.category ?? ""} ${p.subcategory ?? ""} ${(p.ai_design_tags ?? []).join(" ")}`
      .toLowerCase()
      .includes(t),
  );

  return (
    <>
      <PageHeader
        title="Plant palette"
        description={`Samak's plant-intelligence master — botanical identity, tolerance ratings and regional fit behind design, BOQ, nursery and Samak Care. ${query.data?.length ?? 0} species on file.`}
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search botanical, common, local name, family or design tag…"
        className="max-w-md"
      />
      {rows.length === 0 ? (
        <EmptyState title="No species match" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const bestRegions = REGION_FIELDS.filter(([key]) => Number(p[key] ?? 0) >= 4).map(
              ([, label]) => label,
            );
            return (
              <article key={p.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-base font-semibold italic">
                      {p.botanical_name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {p.common_name}
                      {p.local_name ? ` · ${p.local_name}` : ""}
                    </p>
                  </div>
                  {p.samak_preferred ? (
                    <span
                      className={
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase " +
                        (p.samak_preferred.toLowerCase() === "avoid"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : p.samak_preferred.toLowerCase() === "preferred"
                            ? "border-success/30 bg-success/15 text-success"
                            : "border-border bg-muted text-muted-foreground")
                      }
                    >
                      {p.samak_preferred}
                    </span>
                  ) : null}
                </div>

                <p className="mt-1 text-xs text-muted-foreground">
                  {[p.family, p.subcategory || p.category, p.native_status]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Category", titleCase(p.category ?? "—")],
                    ["Sunlight", titleCase(p.sunlight ?? "—")],
                    ["Water need", titleCase(p.water_need ?? "—")],
                    ["Maintenance", titleCase(p.maintenance_level ?? "—")],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                {p.mature_height_m || p.mature_spread_m ? (
                  <p className="mt-3 text-sm">
                    {p.mature_height_m ? (
                      <>
                        Height:{" "}
                        <span className="text-numeric font-medium">
                          {Number(p.mature_height_m)} m
                        </span>
                      </>
                    ) : null}
                    {p.mature_spread_m ? (
                      <>
                        {p.mature_height_m ? " · " : ""}Spread:{" "}
                        <span className="text-numeric font-medium">
                          {Number(p.mature_spread_m)} m
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}

                {TOLERANCE_FIELDS.some(([key]) => p[key] != null) ? (
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {TOLERANCE_FIELDS.filter(([key]) => p[key] != null).map(([key, label]) => (
                      <span key={key}>
                        {label}{" "}
                        <span className="text-numeric font-medium text-foreground">{p[key]}/5</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {bestRegions.length > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Strong fit: <span className="text-foreground">{bestRegions.join(", ")}</span>
                  </p>
                ) : null}

                {p.ai_design_tags && p.ai_design_tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.ai_design_tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {p.notes ? <p className="mt-3 text-xs text-muted-foreground">{p.notes}</p> : null}

                <p className="mt-3 text-[10px] text-muted-foreground">
                  {p.plant_code ?? "—"}
                  {p.samak_field_rating ? ` · Field rating ${p.samak_field_rating}/5` : ""}
                </p>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

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
          "Central species master with habit, sunlight, water need, maintenance level and nursery rate for Indian landscapes.",
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

function PlantsPage() {
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["plant_species"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_species")
        .select(
          "id, botanical_name, common_name, category, sunlight, water_need, maintenance_level, mature_height_m, native_region, notes",
        )
        .order("botanical_name");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((p) =>
    `${p.botanical_name} ${p.common_name ?? ""} ${p.category ?? ""}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Plant palette"
        description="Single species master used by design, BOQ, nursery, PlantIQ and Samak Care."
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search botanical or common name…"
        className="max-w-sm"
      />
      {rows.length === 0 ? (
        <EmptyState title="No species match" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => (
            <article key={p.id} className="rounded-xl border border-border bg-card p-4">
              <p className="font-display text-base font-semibold italic">{p.botanical_name}</p>
              <p className="text-sm text-muted-foreground">
                {p.common_name}
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
              {p.mature_height_m ? (
                <p className="mt-3 text-sm">
                  Mature height:{" "}
                  <span className="text-numeric font-medium">{Number(p.mature_height_m)} m</span>
                </p>
              ) : null}
              {p.notes ? <p className="mt-2 text-xs text-muted-foreground">{p.notes}</p> : null}
            </article>
          ))}
        </div>
      )}
    </>
  );
}

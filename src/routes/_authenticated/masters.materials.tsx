import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { inr, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/masters/materials")({
  head: () => ({
    meta: [
      { title: "Materials master — EnvironIQ" },
      {
        name: "description",
        content:
          "Central material master with category, unit of measure, standard rate and reorder level for procurement and inventory.",
      },
      { property: "og:title", content: "Materials master — EnvironIQ" },
      {
        property: "og:description",
        content: "Material master with UOM, standard rate and reorder level for procurement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaterialsPage,
});

function MaterialsPage() {
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, category, uom, standard_rate, hsn_code")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((m) =>
    `${m.name} ${m.code} ${m.category ?? ""}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Materials master"
        description="Shared by BOQ, procurement, inventory and site issue — no duplicate masters."
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search materials…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No materials match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Material</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">UOM</th>
                <th className="px-4 py-2 text-right font-medium">Standard rate</th>
                
                <th className="hidden px-4 py-2 font-medium lg:table-cell">HSN</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{titleCase(m.category ?? "—")}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.uom}</td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {m.standard_rate ? inr(Number(m.standard_rate)) : "—"}
                  </td>
                  
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {m.hsn_code ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

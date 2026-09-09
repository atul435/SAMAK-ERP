import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { inr, pct, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/crm/opportunities")({
  head: () => ({
    meta: [
      { title: "Opportunities — EnvironIQ CRM" },
      {
        name: "description",
        content: "Weighted landscape pipeline with values, probability and expected close dates.",
      },
      { property: "og:title", content: "Opportunities — EnvironIQ CRM" },
      {
        property: "og:description",
        content: "Weighted landscape pipeline with probability and expected close dates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OpportunitiesPage,
});

function OpportunitiesPage() {
  const query = useQuery({
    queryKey: ["opportunities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select(
          "id, opportunity_code, title, value, probability, stage, expected_close_date, clients(name)",
        )
        .order("value", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];
  const total = rows.reduce((s, o) => s + Number(o.value ?? 0), 0);
  const weighted = rows.reduce(
    (s, o) => s + (Number(o.value ?? 0) * Number(o.probability ?? 0)) / 100,
    0,
  );

  return (
    <>
      <PageHeader title="Opportunities" description="Qualified pipeline moving towards contract." />
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pipeline value" value={inr(total, true)} hint={`${rows.length} deals`} />
        <StatCard label="Weighted forecast" value={inr(weighted, true)} />
        <StatCard
          label="Average probability"
          value={pct(rows.length ? rows.reduce((s, o) => s + Number(o.probability ?? 0), 0) / rows.length : 0)}
        />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No opportunities yet" description="Qualify a lead to create one." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Opportunity</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Client</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 text-right font-medium">Probability</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Expected close</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{o.opportunity_code}</p>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {o.clients?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">{inr(Number(o.value ?? 0), true)}</td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {pct(Number(o.probability ?? 0))}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={o.stage} />
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                    {o.expected_close_date ? shortDate(o.expected_close_date) : "—"}
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

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/crm/clients")({
  head: () => ({
    meta: [
      { title: "Clients — EnvironIQ CRM" },
      {
        name: "description",
        content: "Central client master shared by projects, quotations, billing and Samak Care contracts.",
      },
      { property: "og:title", content: "Clients — EnvironIQ CRM" },
      {
        property: "og:description",
        content: "Central client master shared across every EnvironIQ module.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, client_code, name, sector, city, state, gstin, owner_employee_id, projects(id)")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((c) =>
    `${c.name} ${c.client_code} ${c.city ?? ""}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Clients"
        description="One client master — never duplicated across modules."
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search clients…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No clients found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Sector</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Location</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">GSTIN</th>
                <th className="px-4 py-2 text-right font-medium">Projects</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.client_code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{titleCase(c.sector ?? "—")}</td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {c.city}, {c.state}
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {c.gstin ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">{c.projects?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

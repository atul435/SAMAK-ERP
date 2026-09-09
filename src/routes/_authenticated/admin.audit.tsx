import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateTime, titleCase } from "@/lib/format";

const PAGE_SIZE = 50;

export const Route = createFileRoute("/_authenticated/admin/audit")({
  head: () => ({
    meta: [
      { title: "Audit log — EnvironIQ admin" },
      {
        name: "description",
        content: "Immutable record of every insert, update and delete across the Samak ERP.",
      },
      { property: "og:title", content: "Audit log — EnvironIQ admin" },
      {
        property: "og:description",
        content: "Immutable record of every change across the ERP, with actor and timestamp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuditPage,
});

function AuditPage() {
  const [page, setPage] = useState(0);
  const [table, setTable] = useState("");

  const query = useQuery({
    queryKey: ["audit", page, table],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("id, table_name, record_id, action, actor_user_id, created_at", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);
      if (table.trim()) q = q.ilike("table_name", `%${table.trim()}%`);
      const { data, error, count } = await q;
      if (error) throw error;
      return { rows: data ?? [], count: count ?? 0 };
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const { rows, count } = query.data!;

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Financial, contractual and operational records are never silently deleted — every change is recorded here."
      />
      <Input
        value={table}
        onChange={(e) => {
          setPage(0);
          setTable(e.target.value);
        }}
        placeholder="Filter by table, e.g. projects"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No audit entries" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">When</th>
                  <th className="px-4 py-2 font-medium">Table</th>
                  <th className="px-4 py-2 font-medium">Operation</th>
                  <th className="px-4 py-2 font-medium">Actor</th>
                  <th className="hidden px-4 py-2 font-medium lg:table-cell">Record</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2 text-muted-foreground">{dateTime(r.created_at)}</td>
                    <td className="px-4 py-2 font-medium">{r.table_name}</td>
                    <td className="px-4 py-2">{titleCase(r.action)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{r.actor_user_id ? r.actor_user_id.slice(0, 8) : "System"}</td>
                    <td className="hidden px-4 py-2 font-mono text-xs text-muted-foreground lg:table-cell">
                      {r.record_id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {page * PAGE_SIZE + 1}–{page * PAGE_SIZE + rows.length} of {count}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={(page + 1) * PAGE_SIZE >= count}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({
    meta: [
      { title: "Documents — EnvironIQ" },
      {
        name: "description",
        content: "Contracts, drawings, certificates and site records linked to their source records.",
      },
      { property: "og:title", content: "Documents — EnvironIQ" },
      {
        property: "og:description",
        content: "Contracts, drawings and certificates linked to projects and clients.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, title, doc_type, file_url, version, created_at, projects(name, project_code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((d) =>
    `${d.title} ${d.doc_type}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every record links back to its project, client or transaction — nothing floats free."
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search documents…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No documents found" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground">
                  {titleCase(d.doc_type)} · v{d.version ?? 1} ·{" "}
                  {d.projects?.project_code ? `${d.projects.project_code} · ` : ""}
                  {shortDate(d.created_at)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

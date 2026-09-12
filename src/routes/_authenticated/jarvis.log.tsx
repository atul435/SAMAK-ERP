import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { dateTime, pct } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/jarvis/log")({
  head: () => ({
    meta: [
      { title: "AI task log — EnvironIQ GrowIQ" },
      {
        name: "description",
        content:
          "Every GrowIQ question, answer, confidence score and action is logged for governance and review.",
      },
      { property: "og:title", content: "AI task log — EnvironIQ GrowIQ" },
      {
        property: "og:description",
        content: "Every GrowIQ question, answer and action logged for governance.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JarvisLogPage,
});

function JarvisLogPage() {
  const query = useQuery({
    queryKey: ["ai_interactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_interactions")
        .select("id, question, answer, confidence, action_taken, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="AI task log"
        description="GrowIQ may analyse and recommend, but sensitive actions always require authorised human approval. Every interaction is recorded here."
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No GrowIQ interactions yet"
          description="Open the GrowIQ panel and ask a question about your live ERP data."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">{r.question}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.answer}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Confidence {pct(Number(r.confidence ?? 0) * 100)} ·{" "}
                {r.action_taken ?? "recommendation_only"} · {dateTime(r.created_at)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { dateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — EnvironIQ" },
      {
        name: "description",
        content: "Approval, project, procurement and horticulture alerts for your Samak Landscape workspace.",
      },
      { property: "og:title", content: "Notifications — EnvironIQ" },
      {
        property: "og:description",
        content: "Approval, project, procurement and horticulture alerts for your workspace.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, category, severity, is_read, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader title="Notifications" description="Everything flagged to you across the ERP." />
      {rows.length === 0 ? (
        <EmptyState title="You're all caught up" description="No notifications right now." />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {rows.map((n) => (
            <li key={n.id} className="flex items-start gap-3 p-4">
              <span
                className={
                  n.is_read
                    ? "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border"
                    : "mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{n.title}</p>
                {n.body ? <p className="text-sm text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {n.category} · {n.severity} · {dateTime(n.created_at)}
                </p>
              </div>
              {!n.is_read ? (
                <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)}>
                  Mark read
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

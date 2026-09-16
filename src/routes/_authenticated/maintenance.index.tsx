import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/")({
  head: () => ({
    meta: [
      { title: "Maintenance — EnvironIQ" },
      {
        name: "description",
        content:
          "Portfolio view of every landscape maintenance contract, site, task and open issue.",
      },
      { property: "og:title", content: "Maintenance — EnvironIQ" },
      { property: "og:description", content: "Contracts, sites, tasks and issues at a glance." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceDashboard,
});

function MaintenanceDashboard() {
  const query = useQuery({
    queryKey: ["maintenance-dashboard"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [contracts, sites, tasksDue, tasksOverdue, issues, inspections] = await Promise.all([
        supabase
          .from("maintenance_contracts")
          .select("id", { count: "exact", head: true })
          .eq("status", "active")
          .eq("is_archived", false),
        supabase
          .from("maintenance_sites")
          .select("id", { count: "exact", head: true })
          .eq("is_archived", false),
        supabase
          .from("maintenance_tasks")
          .select("id", { count: "exact", head: true })
          .eq("planned_date", today)
          .in("status", ["planned", "in_progress"]),
        supabase
          .from("maintenance_tasks")
          .select("id", { count: "exact", head: true })
          .lt("planned_date", today)
          .in("status", ["planned", "in_progress"]),
        supabase
          .from("maintenance_issues")
          .select("id, title, severity, status, created_at, maintenance_sites(name)")
          .not("status", "in", "(closed,verified)")
          .order("severity", { ascending: false })
          .limit(8),
        supabase
          .from("maintenance_inspections")
          .select("id, inspection_date, overall_score, maintenance_sites(name)")
          .order("inspection_date", { ascending: false })
          .limit(6),
      ]);
      return {
        activeContracts: contracts.count ?? 0,
        totalSites: sites.count ?? 0,
        tasksDueToday: tasksDue.count ?? 0,
        tasksOverdue: tasksOverdue.count ?? 0,
        openIssues: issues.data ?? [],
        recentInspections: inspections.data ?? [],
      };
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  const d = query.data!;

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Portfolio view across every AMC, PLANTORENT and managed-landscape contract."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Link to="/maintenance/contracts">
          <StatCard label="Active contracts" value={String(d.activeContracts)} />
        </Link>
        <Link to="/maintenance/sites">
          <StatCard label="Sites" value={String(d.totalSites)} />
        </Link>
        <Link to="/maintenance/visits">
          <StatCard label="Visits due today" value={String(d.tasksDueToday)} />
        </Link>
        <Link to="/maintenance/visits">
          <StatCard
            label="Visits overdue"
            value={String(d.tasksOverdue)}
            tone={d.tasksOverdue > 0 ? "danger" : "default"}
          />
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Open requests</p>
            <Link to="/maintenance/requests" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          {d.openIssues.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No open issues.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.openIssues.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.maintenance_sites?.name ?? "—"} · {titleCase(i.severity)}
                    </p>
                  </div>
                  <StatusBadge value={i.status} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <p className="font-display text-sm font-semibold">Recent inspections</p>
            <Link to="/maintenance/inspections" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </div>
          {d.recentInspections.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No inspections recorded yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {d.recentInspections.map((i) => (
                <li key={i.id} className="flex items-center justify-between text-sm">
                  <span>{i.maintenance_sites?.name ?? "—"}</span>
                  <span className="text-xs text-muted-foreground">
                    {shortDate(i.inspection_date)}
                    {i.overall_score != null ? ` · ${i.overall_score}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

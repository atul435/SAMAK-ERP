import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_portal/portal/maintenance")({
  head: () => ({
    meta: [
      { title: "Your maintenance — Samak Landscape portal" },
      {
        name: "description",
        content: "Your landscape maintenance sites, visit schedule, inspections and open issues.",
      },
      { property: "og:title", content: "Your maintenance — Samak Landscape portal" },
      {
        property: "og:description",
        content: "Visit history, inspection scores and issue status for your AMC sites.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalMaintenance,
});

function PortalMaintenance() {
  const query = useQuery({
    queryKey: ["portal-maintenance"],
    queryFn: async () => {
      const [sites, tasks, inspections, issues] = await Promise.all([
        supabase
          .from("maintenance_sites")
          .select("id, site_code, name, city, status, maintenance_contracts(title, frequency)")
          .eq("is_archived", false)
          .order("name"),
        supabase
          .from("maintenance_tasks")
          .select("id, title, task_type, status, planned_date, maintenance_sites(name)")
          .order("planned_date", { ascending: false })
          .limit(30),
        supabase
          .from("maintenance_inspections")
          .select("id, inspection_date, overall_score, notes, maintenance_sites(name)")
          .order("inspection_date", { ascending: false })
          .limit(10),
        supabase
          .from("maintenance_issues")
          .select("id, title, severity, status, created_at, maintenance_sites(name)")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
      if (sites.error) throw sites.error;
      if (tasks.error) throw tasks.error;
      if (inspections.error) throw inspections.error;
      if (issues.error) throw issues.error;
      return {
        sites: sites.data ?? [],
        tasks: tasks.data ?? [],
        inspections: inspections.data ?? [],
        issues: issues.data ?? [],
      };
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your maintenance sites…" />;
  if (query.error)
    return <ErrorState message="We could not load your maintenance records right now." />;
  const { sites, tasks, inspections, issues } = query.data!;

  const upcoming = tasks.filter((t) => ["planned", "in_progress"].includes(t.status));
  const openIssues = issues.filter((i) => !["closed", "verified"].includes(i.status));
  const recentVisits = tasks.filter((t) => t.status === "completed").slice(0, 10);

  return (
    <>
      <PageHeader
        title="Your maintenance"
        description="Sites under an active maintenance agreement with Samak Landscape — visits, inspections and issue status."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Sites" value={String(sites.length)} />
        <StatCard label="Upcoming / active visits" value={String(upcoming.length)} />
        <StatCard
          label="Open issues"
          value={String(openIssues.length)}
          tone={openIssues.length > 0 ? "warning" : "success"}
        />
        <StatCard label="Inspections on record" value={String(inspections.length)} />
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Your sites</h2>
        {sites.length === 0 ? (
          <EmptyState
            title="No maintenance sites yet"
            description="Sites under your AMC will appear here once set up."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sites.map((s) => (
              <div key={s.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.site_code} · {s.city ?? "—"}
                    </p>
                  </div>
                  <StatusBadge value={s.status} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {s.maintenance_contracts
                    ? `${s.maintenance_contracts.title}${s.maintenance_contracts.frequency ? ` · ${s.maintenance_contracts.frequency}` : ""}`
                    : "No contract linked yet"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Upcoming & active visits</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No visits scheduled" description="Upcoming visits will appear here." />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {upcoming.slice(0, 15).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.maintenance_sites?.name ?? "—"} · {titleCase(t.task_type)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-numeric text-xs text-muted-foreground">
                    {shortDate(t.planned_date)}
                  </p>
                  <StatusBadge value={t.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Recent completed visits</h2>
        {recentVisits.length === 0 ? (
          <EmptyState title="No completed visits yet" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {recentVisits.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{t.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.maintenance_sites?.name ?? "—"}
                  </p>
                </div>
                <p className="text-numeric text-xs text-muted-foreground">
                  {shortDate(t.planned_date)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Open issues</h2>
        {openIssues.length === 0 ? (
          <EmptyState
            title="No open issues"
            description="Anything flagged during an inspection or reported by our team will appear here."
          />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {openIssues.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{i.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {i.maintenance_sites?.name ?? "—"} · {titleCase(i.severity)} ·{" "}
                    {shortDate(i.created_at)}
                  </p>
                </div>
                <StatusBadge value={i.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Inspection history</h2>
        {inspections.length === 0 ? (
          <EmptyState title="No inspections recorded yet" />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {inspections.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div>
                  <p className="font-medium">{i.maintenance_sites?.name ?? "—"}</p>
                  {i.notes ? (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{i.notes}</p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="text-numeric text-xs text-muted-foreground">
                    {shortDate(i.inspection_date)}
                  </p>
                  {i.overall_score != null ? (
                    <p className="text-numeric text-xs font-medium">Score {i.overall_score}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

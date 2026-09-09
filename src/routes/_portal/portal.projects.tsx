import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, pct, shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_portal/portal/projects")({
  head: () => ({
    meta: [
      { title: "Your projects — Samak Landscape portal" },
      {
        name: "description",
        content:
          "Track progress, site diaries, weather and blockers on your landscape projects with Samak Landscape.",
      },
      { property: "og:title", content: "Your projects — Samak Landscape portal" },
      {
        property: "og:description",
        content: "Live progress and daily site updates on your landscape projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalProjects,
});

function PortalProjects() {
  const [projectFilter, setProjectFilter] = useState("all");

  const query = useQuery({
    queryKey: ["portal-projects"],
    queryFn: async () => {
      const [projects, reports] = await Promise.all([
        supabase
          .from("projects")
          .select(
            "id, project_code, name, city, state, project_type, contract_value, progress_percent, health, status, start_date, end_date",
          )
          .eq("is_archived", false)
          .order("project_code"),
        supabase
          .from("site_reports")
          .select(
            "id, project_id, report_date, weather, temperature_c, work_done, planned_next, blockers, progress_percent, approval_state",
          )
          .order("report_date", { ascending: false })
          .limit(60),
      ]);
      if (projects.error) throw projects.error;
      if (reports.error) throw reports.error;
      return { projects: projects.data ?? [], reports: reports.data ?? [] };
    },
  });

  if (query.isLoading) return <LoadingState label="Loading your projects…" />;
  if (query.error) return <ErrorState message="We could not load your projects right now." />;
  const { projects, reports } = query.data!;

  const visible = projectFilter === "all" ? projects : projects.filter((p) => p.id === projectFilter);
  const visibleIds = new Set(visible.map((p) => p.id));
  const diary = reports.filter((r) => visibleIds.has(r.project_id));
  const nameOf = (id: string) => projects.find((p) => p.id === id)?.name ?? "Project";

  return (
    <>
      <PageHeader
        title="Your projects"
        description="Progress against contract and the daily site record our team files from your site."
        actions={
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="All projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {visible.length === 0 ? (
        <EmptyState title="No projects to show" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.project_code} · {titleCase(p.project_type)} · {p.city ?? "—"}
                  </p>
                </div>
                <StatusBadge value={p.health ?? p.status} />
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, Number(p.progress_percent ?? 0))}%` }}
                />
              </div>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Progress</dt>
                  <dd className="text-numeric font-medium">{pct(p.progress_percent)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Contract</dt>
                  <dd className="text-numeric font-medium">{inr(p.contract_value, true)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Handover</dt>
                  <dd className="font-medium">{shortDate(p.end_date)}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold">Site updates</h2>
        {diary.length === 0 ? (
          <EmptyState
            title="No site updates yet"
            description="Daily updates appear here once work starts on site."
          />
        ) : (
          <ul className="space-y-3">
            {diary.slice(0, 20).map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">
                    {shortDate(r.report_date)} · {nameOf(r.project_id)}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {titleCase(r.weather)}
                    {r.temperature_c != null ? ` · ${r.temperature_c}°C` : ""} ·{" "}
                    {pct(r.progress_percent)} complete
                  </span>
                </div>
                {r.work_done ? <p className="mt-2 text-sm">{r.work_done}</p> : null}
                {r.planned_next ? (
                  <p className="mt-1 text-sm text-muted-foreground">Next: {r.planned_next}</p>
                ) : null}
                {r.blockers ? (
                  <p className="mt-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs text-warning-foreground">
                    Attention needed: {r.blockers}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, pct, shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Project control — EnvironIQ" },
      {
        name: "description",
        content:
          "Track landscape project value, cost, progress, health and delivery dates across the Samak portfolio.",
      },
      { property: "og:title", content: "Project control — EnvironIQ" },
      {
        property: "og:description",
        content: "Value, cost, progress and health across the Samak Landscape project portfolio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const [term, setTerm] = useState("");
  const [health, setHealth] = useState("all");
  const [status, setStatus] = useState("all");

  const query = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, project_code, name, city, state, status, health, progress_percent, contract_value, budget_cost, actual_cost, billed_amount, collected_amount, start_date, end_date, clients(name)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const all = query.data ?? [];
  const rows = all.filter((p) => {
    const t = term.trim().toLowerCase();
    if (t && !`${p.name} ${p.project_code} ${p.city ?? ""}`.toLowerCase().includes(t)) return false;
    if (health !== "all" && p.health !== health) return false;
    if (status !== "all" && p.status !== status) return false;
    return true;
  });

  const value = all.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
  const cost = all.reduce((s, p) => s + Number(p.actual_cost ?? 0), 0);
  const margin = value ? ((value - cost) / value) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Project control"
        description="Every landscape project with live value, committed cost, progress and health."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Contract value" value={inr(value, true)} hint={`${all.length} projects`} />
        <StatCard label="Actual cost booked" value={inr(cost, true)} />
        <StatCard
          label="Gross margin"
          value={pct(margin)}
          tone={margin < 15 ? "warning" : "success"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search project, code or city…"
          className="max-w-xs"
        />
        <Select value={health} onValueChange={setHealth}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Health" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            <SelectItem value="on_track">On track</SelectItem>
            <SelectItem value="at_risk">At risk</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {["in_progress", "approved", "completed", "blocked", "archived"].map((s) => (
              <SelectItem key={s} value={s}>
                {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No projects match" description="Adjust your filters or search term." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Client</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Health</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 text-right font-medium">Progress</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Completion</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: p.id }}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {p.project_code} · {p.city}, {p.state}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {p.clients?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={p.status} />
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={p.health ?? "on_track"} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {inr(Number(p.contract_value ?? 0), true)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {pct(Number(p.progress_percent ?? 0))}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                    {p.end_date ? shortDate(p.end_date) : "—"}
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

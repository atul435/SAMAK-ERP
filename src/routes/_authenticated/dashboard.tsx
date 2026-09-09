import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Briefcase,
  IndianRupee,
  AlertTriangle,
  CheckSquare,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { inr, pct, shortDate } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Executive dashboard — EnvironIQ" },
      {
        name: "description",
        content:
          "Live portfolio value, project health, pending approvals and pipeline for Samak Landscape.",
      },
      { property: "og:title", content: "Executive dashboard — EnvironIQ" },
      {
        property: "og:description",
        content: "Live portfolio value, project health, approvals and pipeline for Samak Landscape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { employee } = useAuth();

  const query = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [projects, approvals, leads, opportunities, activities] = await Promise.all([
        supabase
          .from("projects")
          .select(
            "id, project_code, name, city, status, health, progress_percent, contract_value, actual_cost, billed_amount, collected_amount, end_date",
          )
          .order("contract_value", { ascending: false }),
        supabase
          .from("approval_requests")
          .select("id, request_code, entity_type, entity_label, amount, state, created_at")
          .in("state", ["submitted", "pending_approval"])
          .order("created_at", { ascending: false })
          .limit(6),
        supabase.from("leads").select("id, lead_code, title, stage, estimated_value, score").order("score", { ascending: false }).limit(6),
        supabase.from("opportunities").select("value, probability, stage"),
        supabase
          .from("activities")
          .select("id, subject, activity_type, created_at")
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      if (projects.error) throw projects.error;
      return {
        projects: projects.data ?? [],
        approvals: approvals.data ?? [],
        leads: leads.data ?? [],
        opportunities: opportunities.data ?? [],
        activities: activities.data ?? [],
      };
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const d = query.data!;
  const portfolio = d.projects.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
  const billed = d.projects.reduce((s, p) => s + Number(p.billed_amount ?? 0), 0);
  const collected = d.projects.reduce((s, p) => s + Number(p.collected_amount ?? 0), 0);
  const receivables = billed - collected;
  const atRisk = d.projects.filter((p) => p.health === "at_risk" || p.health === "critical");
  const weighted = d.opportunities.reduce(
    (s, o) => s + (Number(o.value ?? 0) * Number(o.probability ?? 0)) / 100,
    0,
  );

  return (
    <>
      <PageHeader
        title={`Good day, ${employee?.full_name?.split(" ")[0] ?? "there"}`}
        description="Live position across projects, approvals, cash and pipeline — all from your permitted records."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Portfolio value"
          value={inr(portfolio, true)}
          hint={`${d.projects.length} active projects`}
          icon={<Briefcase className="h-4 w-4" />}
        />
        <StatCard
          label="Outstanding receivables"
          value={inr(receivables, true)}
          hint={`${inr(collected, true)} collected of ${inr(billed, true)} billed`}
          icon={<IndianRupee className="h-4 w-4" />}
          tone={receivables > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Projects at risk"
          value={String(atRisk.length)}
          hint="Health flagged at risk or critical"
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={atRisk.length ? "danger" : "success"}
        />
        <StatCard
          label="Weighted pipeline"
          value={inr(weighted, true)}
          hint={`${d.opportunities.length} live opportunities`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="xl:col-span-2 rounded-xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-semibold">Project portfolio</h2>
            <Link to="/projects" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </header>
          {d.projects.length === 0 ? (
            <EmptyState title="No projects visible" description="You have no project access yet." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Project</th>
                    <th className="px-4 py-2 font-medium">Health</th>
                    <th className="px-4 py-2 text-right font-medium">Value</th>
                    <th className="px-4 py-2 text-right font-medium">Progress</th>
                    <th className="hidden px-4 py-2 font-medium md:table-cell">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {d.projects.map((p) => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                      <td className="px-4 py-2.5">
                        <Link to="/projects/$projectId" params={{ projectId: p.id }} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <span className="block text-xs text-muted-foreground">
                          {p.project_code} · {p.city}
                        </span>
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
                      <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                        {p.end_date ? shortDate(p.end_date) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-semibold">Awaiting approval</h2>
              <Link to="/approvals" className="text-sm text-primary hover:underline">
                Open
              </Link>
            </header>
            <ul className="divide-y divide-border">
              {d.approvals.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground">Nothing pending.</li>
              ) : (
                d.approvals.map((a) => (
                  <li key={a.id} className="flex items-start gap-3 px-4 py-3">
                    <CheckSquare className="mt-0.5 h-4 w-4 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{a.entity_label}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.request_code} · {a.entity_type}
                        {a.amount ? ` · ${inr(Number(a.amount), true)}` : ""}
                      </p>
                    </div>
                    <StatusBadge value={a.state} />
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="rounded-xl border border-border bg-card">
            <header className="border-b border-border px-4 py-3">
              <h2 className="font-display text-base font-semibold">Recent activity</h2>
            </header>
            <ul className="divide-y divide-border">
              {d.activities.length === 0 ? (
                <li className="px-4 py-6 text-sm text-muted-foreground">No activity logged.</li>
              ) : (
                d.activities.map((a) => (
                  <li key={a.id} className="px-4 py-2.5">
                    <p className="text-sm">{a.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.activity_type} · {shortDate(a.created_at)}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}

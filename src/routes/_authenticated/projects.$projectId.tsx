import { computeTotals } from "@/lib/boq";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { inr, pct, shortDate, dateTime, titleCase } from "@/lib/format";
import { daysToClose } from "@/lib/tenders";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  head: () => ({
    meta: [
      { title: "Project detail — EnvironIQ" },
      {
        name: "description",
        content:
          "Commercials, team, approvals, documents and activity history for a Samak Landscape project.",
      },
      { property: "og:title", content: "Project detail — EnvironIQ" },
      {
        property: "og:description",
        content: "Commercials, team, approvals, documents and activity for a landscape project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();

  const query = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const [
        project,
        members,
        approvals,
        documents,
        activities,
        designs,
        boqs,
        execution,
        tenders,
      ] = await Promise.all([
        supabase
          .from("projects")
          .select("*, clients(name, client_code, city), employees:project_manager_id(full_name, designation)")
          .eq("id", projectId)
          .maybeSingle(),
        supabase
          .from("project_members")
          .select("id, role_on_project, employees(full_name, designation)")
          .eq("project_id", projectId),
        supabase
          .from("approval_requests")
          .select("id, request_code, entity_type, entity_label, amount, state, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("documents")
          .select("id, title, doc_type, file_url, created_at")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false }),
        supabase
          .from("activities")
          .select("id, subject, body, activity_type, created_at")
          .eq("entity_id", projectId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("designs")
          .select("id, design_code, title, stage, design_type, current_revision, approval_state")
          .eq("project_id", projectId)
          .eq("is_archived", false)
          .order("design_code"),
        supabase
          .from("boqs")
          .select(
            "id, boq_code, title, version, approval_state, overhead_percent, profit_percent, contingency_percent, tax_percent, designs(design_code), boq_items(quantity, wastage_percent, unit_rate, item_kind)",
          )
          .eq("project_id", projectId)
          .eq("is_archived", false)
          .order("boq_code"),
        supabase
          .from("project_boq_progress")
          .select("planned_amount, executed_amount, progress_percent")
          .eq("project_id", projectId)
          .maybeSingle(),
        supabase
          .from("tenders")
          .select(
            "id, tender_ref, organisation, title, closing_on, estimated_value, status, source_url",
          )
          .eq("project_id", projectId)
          .eq("is_archived", false)
          .order("closing_on", { ascending: true, nullsFirst: false }),
      ]);
      if (project.error) throw project.error;
      return {
        project: project.data,
        members: members.data ?? [],
        approvals: approvals.data ?? [],
        documents: documents.data ?? [],
        activities: activities.data ?? [],
        designs: designs.data ?? [],
        boqs: boqs.data ?? [],
        execution: execution.data,
        tenders: tenders.data ?? [],
      };
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!query.data?.project)
    return <ErrorState message="This project does not exist or you do not have access to it." />;

  const p = query.data.project;
  const value = Number(p.contract_value ?? 0);
  const actual = Number(p.actual_cost ?? 0);
  const committed = Number(p.committed_cost ?? 0);
  const billed = Number(p.billed_amount ?? 0);
  const collected = Number(p.collected_amount ?? 0);
  const margin = value ? ((value - actual - committed) / value) * 100 : 0;
  const exec = query.data.execution;
  const executedValue = Number(exec?.executed_amount ?? 0);
  const plannedValue = Number(exec?.planned_amount ?? 0);

  return (
    <>
      <PageHeader
        title={p.name}
        description={`${p.project_code} · ${p.clients?.name ?? "No client"} · ${p.city ?? ""}, ${p.state ?? ""}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={p.status} />
            <StatusBadge value={p.health ?? "on_track"} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Contract value" value={inr(value, true)} />
        <StatCard
          label="Work executed"
          value={pct(Number(p.progress_percent ?? 0))}
          hint={
            plannedValue > 0
              ? `${inr(executedValue, true)} of ${inr(plannedValue, true)} measured on site`
              : "No approved estimate to measure against"
          }
          tone={plannedValue > 0 ? "success" : "default"}
        />
        <StatCard
          label="Cost to date"
          value={inr(actual, true)}
          hint={`${inr(committed, true)} committed`}
        />
        <StatCard
          label="Forecast margin"
          value={pct(margin)}
          tone={margin < 12 ? "danger" : margin < 20 ? "warning" : "success"}
        />
        <StatCard
          label="Receivable"
          value={inr(billed - collected, true)}
          hint={`${inr(billed, true)} billed`}
          tone={billed - collected > 0 ? "warning" : "success"}
        />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="designs">Designs</TabsTrigger>
          <TabsTrigger value="boqs">Estimates</TabsTrigger>
          <TabsTrigger value="tenders">Tenders</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <dl className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Project type", titleCase(p.project_type ?? "—")],
              ["Site area", p.area_sqm ? `${Number(p.area_sqm).toLocaleString("en-IN")} m²` : "—"],
              ["Progress", pct(Number(p.progress_percent ?? 0))],
              ["Start date", p.start_date ? shortDate(p.start_date) : "—"],
              ["Target completion", p.end_date ? shortDate(p.end_date) : "—"],
              ["Project manager", p.employees?.full_name ?? "Unassigned"],
              ["Budget cost", inr(Number(p.budget_cost ?? 0), true)],
              ["Collected", inr(collected, true)],
              [
                "Location",
                p.latitude && p.longitude ? `${p.latitude}, ${p.longitude}` : "Not geotagged",
              ],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {query.data.members.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">No team members assigned yet.</li>
            ) : (
              query.data.members.map((m) => (
                <li key={m.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{m.employees?.full_name}</p>
                    <p className="text-xs text-muted-foreground">{m.employees?.designation}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {titleCase(m.role_on_project ?? "")}
                  </span>
                </li>
              ))
            )}
          </ul>
        </TabsContent>

        <TabsContent value="designs" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {query.data.designs.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">
                No designs linked to this project yet.
              </li>
            ) : (
              query.data.designs.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <Link
                      to="/design/$designId"
                      params={{ designId: d.id }}
                      className="truncate text-sm font-medium hover:underline"
                    >
                      {d.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {d.design_code} · Rev {d.current_revision} · {titleCase(d.stage ?? "")} ·{" "}
                      {titleCase(d.design_type ?? "")}
                    </p>
                  </div>
                  <StatusBadge value={d.approval_state} />
                </li>
              ))
            )}
          </ul>
          <Link to="/design" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open Design Studio
          </Link>
        </TabsContent>

        <TabsContent value="boqs" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {query.data.boqs.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">
                No estimates prepared for this project yet.
              </li>
            ) : (
              query.data.boqs.map((b) => {
                const totals = computeTotals(b.boq_items ?? [], b);
                return (
                  <li key={b.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <Link
                        to="/boq/$boqId"
                        params={{ boqId: b.id }}
                        className="truncate text-sm font-medium hover:underline"
                      >
                        {b.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {b.boq_code} · v{b.version}
                        {b.designs ? ` · ${b.designs.design_code}` : ""} · direct{" "}
                        {inr(totals.direct, true)} · quoted {inr(totals.grand, true)}
                      </p>
                    </div>
                    <StatusBadge value={b.approval_state} />
                  </li>
                );
              })
            )}
          </ul>
          <Link to="/boq" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open BOQ & Estimation
          </Link>
        </TabsContent>

        <TabsContent value="tenders" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {query.data.tenders.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">
                No tender is linked to this project yet. Link one from Upcoming Tenders.
              </li>
            ) : (
              query.data.tenders.map((t) => {
                const left = daysToClose(t.closing_on);
                return (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      {t.source_url ? (
                        <a
                          href={t.source_url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-sm font-medium hover:underline"
                        >
                          {t.title}
                        </a>
                      ) : (
                        <p className="text-sm font-medium">{t.title}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t.organisation} · {t.tender_ref} · closes {shortDate(t.closing_on)}
                        {left === null
                          ? ""
                          : left < 0
                            ? ` · closed ${Math.abs(left)} days ago`
                            : ` · ${left} days left`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-numeric text-sm font-semibold">
                        {t.estimated_value ? inr(Number(t.estimated_value), true) : "Value not stated"}
                      </p>
                      <StatusBadge value={t.status} />
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <Link to="/crm/tenders" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open Upcoming Tenders
          </Link>
        </TabsContent>

        <TabsContent value="approvals" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {query.data.approvals.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">
                No approval requests raised for this project.
              </li>
            ) : (
              query.data.approvals.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.entity_label}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.request_code} · {titleCase(a.entity_type)}
                      {a.amount ? ` · ${inr(Number(a.amount), true)}` : ""}
                    </p>
                  </div>
                  <StatusBadge value={a.state} />
                </li>
              ))
            )}
          </ul>
          <Link to="/approvals" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open approval engine
          </Link>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {query.data.documents.length === 0 ? (
              <li className="p-5 text-sm text-muted-foreground">No documents attached.</li>
            ) : (
              query.data.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-sm font-medium">{doc.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(doc.doc_type)} · {shortDate(doc.created_at)}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <ol className="space-y-3 rounded-xl border border-border bg-card p-5">
            {query.data.activities.length === 0 ? (
              <li className="text-sm text-muted-foreground">No activity recorded.</li>
            ) : (
              query.data.activities.map((a) => (
                <li key={a.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium">{a.subject}</p>
                  {a.body ? <p className="text-sm text-muted-foreground">{a.body}</p> : null}
                  <p className="text-xs text-muted-foreground">
                    {titleCase(a.activity_type)} · {dateTime(a.created_at)}
                  </p>
                </li>
              ))
            )}
          </ol>
        </TabsContent>
      </Tabs>
    </>
  );
}

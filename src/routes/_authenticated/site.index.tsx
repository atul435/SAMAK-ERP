import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, shortDate, titleCase } from "@/lib/format";
import {
  WEATHER_OPTIONS,
  attendanceTotals,
  captureLocation,
  formatCoords,
  type Coords,
} from "@/lib/site-ops";

export const Route = createFileRoute("/_authenticated/site/")({
  head: () => ({
    meta: [
      { title: "Site operations — EnvironIQ" },
      {
        name: "description",
        content:
          "Daily site reports with progress, labour attendance, material receipts, geo-tagged photos and blockers for every live landscape project.",
      },
      { property: "og:title", content: "Site operations — EnvironIQ" },
      {
        property: "og:description",
        content: "Daily progress, manpower, materials and geo-tagged photos straight from site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SiteOperationsPage,
});

function SiteOperationsPage() {
  const { can, employee } = useAuth();
  const canEdit = can("site_ops", "edit");
  const queryClient = useQueryClient();
  const [projectFilter, setProjectFilter] = useState("all");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["site-reports"],
    queryFn: async () => {
      const [reports, projects] = await Promise.all([
        supabase
          .from("site_reports")
          .select(
            "id, report_date, weather, temperature_c, work_done, blockers, progress_percent, latitude, longitude, approval_state, project_id, projects(name, project_code), employees(full_name), labour_attendance(headcount_planned, headcount_present, hours_worked, day_rate), site_photos(id), site_report_items(quantity_planned, quantity_done)",
          )
          .eq("is_archived", false)
          .order("report_date", { ascending: false })
          .limit(120),
        supabase
          .from("projects")
          .select("id, name, project_code")
          .eq("is_archived", false)
          .order("project_code"),
      ]);
      if (reports.error) throw reports.error;
      if (projects.error) throw projects.error;
      return { reports: reports.data ?? [], projects: projects.data ?? [] };
    },
  });

  const materialsQuery = useQuery({
    queryKey: ["site-materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("movement_type, quantity, unit_rate, project_id")
        .not("project_id", "is", null);
      if (error) throw error;
      return data ?? [];
    },
  });

  const createReport = useMutation({
    mutationFn: async (v: {
      projectId: string;
      reportDate: string;
      weather: string;
      temperature: string;
      workDone: string;
      plannedNext: string;
      blockers: string;
      progress: string;
      coords: Coords | null;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { data, error } = await supabase
        .from("site_reports")
        .insert({
          company_id: employee.company_id,
          project_id: v.projectId,
          report_date: v.reportDate,
          reported_by: employee.id,
          weather: v.weather,
          temperature_c: v.temperature ? Number(v.temperature) : null,
          work_done: v.workDone,
          planned_next: v.plannedNext || null,
          blockers: v.blockers || null,
          progress_percent: Number(v.progress || 0),
          latitude: v.coords?.latitude ?? null,
          longitude: v.coords?.longitude ?? null,
          location_accuracy_m: v.coords?.accuracy ?? null,
          status: "submitted",
          approval_state: "submitted",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Daily report logged");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["site-reports"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate")
          ? "A report already exists for that project and date."
          : e.message,
      ),
  });

  const reports = useMemo(() => {
    const all = query.data?.reports ?? [];
    return projectFilter === "all" ? all : all.filter((r) => r.project_id === projectFilter);
  }, [query.data, projectFilter]);

  const dashboard = useMemo(() => {
    const all = reports;
    const projectName = new Map(
      (query.data?.projects ?? []).map((p) => [p.id, `${p.project_code} · ${p.name}`] as const),
    );
    const openDays = all.filter(
      (r) => r.approval_state === "submitted" || r.approval_state === "draft",
    );

    // Work done vs plan, per project
    const workByProject = new Map<string, { planned: number; done: number }>();
    let totPlanned = 0;
    let totDone = 0;
    for (const r of all) {
      const entry = workByProject.get(r.project_id) ?? { planned: 0, done: 0 };
      for (const l of r.site_report_items ?? []) {
        entry.planned += Number(l.quantity_planned ?? 0);
        entry.done += Number(l.quantity_done ?? 0);
      }
      workByProject.set(r.project_id, entry);
    }
    for (const v of workByProject.values()) {
      totPlanned += v.planned;
      totDone += v.done;
    }

    // Labour, per project
    const labourByProject = new Map<string, ReturnType<typeof attendanceTotals>>();
    let totHours = 0;
    let totManDays = 0;
    for (const r of all) {
      const rows = r.labour_attendance ?? [];
      const t = attendanceTotals(rows);
      const prev = labourByProject.get(r.project_id);
      labourByProject.set(r.project_id, {
        planned: (prev?.planned ?? 0) + t.planned,
        present: (prev?.present ?? 0) + t.present,
        absent: (prev?.absent ?? 0) + t.absent,
        manDays: (prev?.manDays ?? 0) + t.manDays,
        cost: (prev?.cost ?? 0) + t.cost,
        fulfilment: 0,
      });
      for (const a of rows) {
        totHours += Number(a.headcount_present ?? 0) * Number(a.hours_worked ?? 8);
      }
      totManDays += t.manDays;
    }

    // Materials received vs issued at site, per project
    const matByProject = new Map<string, { received: number; issued: number; recVal: number; issVal: number }>();
    let totRec = 0;
    let totIss = 0;
    for (const m of materialsQuery.data ?? []) {
      const entry =
        matByProject.get(m.project_id ?? "") ?? { received: 0, issued: 0, recVal: 0, issVal: 0 };
      const qty = Number(m.quantity ?? 0);
      const val = qty * Number(m.unit_rate ?? 0);
      if (m.movement_type === "issue") {
        entry.issued += qty;
        entry.issVal += val;
        totIss += qty;
      } else if (m.movement_type === "receipt") {
        entry.received += qty;
        entry.recVal += val;
        totRec += qty;
      }
      matByProject.set(m.project_id ?? "", entry);
    }

    return {
      openDays,
      workByProject,
      labourByProject,
      matByProject,
      projectName,
      totPlanned,
      totDone,
      totHours,
      totManDays,
      totRec,
      totIss,
    };
  }, [reports, query.data, materialsQuery.data]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const today = new Date().toISOString().slice(0, 10);
  const todays = reports.filter((r) => r.report_date === today);
  const manpowerToday = attendanceTotals(todays.flatMap((r) => r.labour_attendance ?? []));
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weekReports = reports.filter((r) => r.report_date >= weekAgo);
  const weekLabour = attendanceTotals(weekReports.flatMap((r) => r.labour_attendance ?? []));
  const openBlockers = reports.filter((r) => r.blockers && r.report_date >= weekAgo).length;

  return (
    <>
      <PageHeader
        title="Site operations"
        description="One report per site per day — progress, manpower, materials received and geo-tagged photos, all against the project record."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Log daily report</Button>
              </DialogTrigger>
              <NewReportDialog
                projects={query.data?.projects ?? []}
                pending={createReport.isPending}
                onSubmit={(v) => createReport.mutate(v)}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Reports today" value={String(todays.length)} />
        <StatCard
          label="Manpower on site today"
          value={String(manpowerToday.present)}
          hint={`${manpowerToday.planned} planned`}
          tone={manpowerToday.fulfilment < 85 && manpowerToday.planned > 0 ? "warning" : "default"}
        />
        <StatCard label="Labour cost this week" value={inr(weekLabour.cost, true)} />
        <StatCard
          label="Blockers this week"
          value={String(openBlockers)}
          tone={openBlockers > 0 ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="diary">Site diary</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Open site days"
              value={String(dashboard.openDays.length)}
              hint="Reports awaiting review"
              tone={dashboard.openDays.length > 0 ? "warning" : "default"}
            />
            <StatCard
              label="Work done vs plan"
              value={`${dashboard.totPlanned > 0 ? ((dashboard.totDone / dashboard.totPlanned) * 100).toFixed(0) : 0}%`}
              hint={`${dashboard.totDone.toLocaleString("en-IN")} of ${dashboard.totPlanned.toLocaleString("en-IN")} units`}
            />
            <StatCard
              label="Labour hours vs man-days"
              value={dashboard.totHours.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
              hint={`${dashboard.totManDays.toFixed(1)} man-days`}
            />
            <StatCard
              label="Materials issued vs received"
              value={`${dashboard.totRec > 0 ? ((dashboard.totIss / dashboard.totRec) * 100).toFixed(0) : 0}%`}
              hint={`${dashboard.totIss.toLocaleString("en-IN")} issued of ${dashboard.totRec.toLocaleString("en-IN")} received`}
              tone="success"
            />
          </div>

          {dashboard.openDays.length > 0 ? (
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Open site days</h2>
              <p className="text-xs text-muted-foreground">
                Daily reports submitted but not yet reviewed.
              </p>
              <ul className="mt-4 space-y-2">
                {dashboard.openDays.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/site/$reportId"
                      params={{ reportId: r.id }}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm transition-colors hover:border-primary/40"
                    >
                      <span className="min-w-0 truncate">
                        {r.projects?.project_code} · {shortDate(r.report_date)} —{" "}
                        <span className="text-muted-foreground">{r.work_done}</span>
                      </span>
                      <StatusBadge value={r.approval_state} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Work done vs plan</h2>
              <p className="text-xs text-muted-foreground">
                Measured quantities across all reported days, by project.
              </p>
              <ul className="mt-4 space-y-4">
                {[...dashboard.workByProject.entries()]
                  .filter(([, v]) => v.planned > 0)
                  .map(([pid, v]) => {
                    const pct = Math.min(100, (v.done / v.planned) * 100);
                    return (
                      <li key={pid}>
                        <div className="flex items-baseline justify-between gap-3 text-sm">
                          <p className="min-w-0 truncate font-medium">
                            {dashboard.projectName.get(pid) ?? "Project"}
                          </p>
                          <p className="shrink-0 text-xs text-muted-foreground text-numeric">
                            {v.done.toLocaleString("en-IN")} / {v.planned.toLocaleString("en-IN")}
                          </p>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground text-numeric">
                          {pct.toFixed(0)}% of plan
                        </p>
                      </li>
                    );
                  })}
              </ul>
            </section>

            <section className="rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-base font-semibold">Labour hours vs man-days</h2>
              <p className="text-xs text-muted-foreground">
                A man-day is 8 hours actually worked, by project.
              </p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-4 font-medium">Project</th>
                      <th className="py-2 pr-4 text-right font-medium">Present</th>
                      <th className="py-2 pr-4 text-right font-medium">Man-days</th>
                      <th className="py-2 text-right font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dashboard.labourByProject.entries()]
                      .filter(([, v]) => v.present > 0)
                      .map(([pid, v]) => (
                        <tr
                          key={pid}
                          className="border-b border-border last:border-0 hover:bg-secondary/50"
                        >
                          <td className="py-2.5 pr-4 font-medium">
                            {dashboard.projectName.get(pid) ?? "Project"}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-numeric">
                            {v.present}/{v.planned}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-numeric">
                            {v.manDays.toFixed(1)}
                          </td>
                          <td className="py-2.5 text-right text-numeric">{inr(v.cost)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-base font-semibold">Materials issued vs received</h2>
            <p className="text-xs text-muted-foreground">
              What arrived at each site versus what the crews actually drew, in value terms.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="py-2 pr-4 font-medium">Project</th>
                    <th className="py-2 pr-4 text-right font-medium">Received</th>
                    <th className="py-2 pr-4 text-right font-medium">Issued</th>
                    <th className="py-2 pr-4 text-right font-medium">Drawn</th>
                    <th className="py-2 text-right font-medium">Value issued</th>
                  </tr>
                </thead>
                <tbody>
                  {[...dashboard.matByProject.entries()].map(([pid, v]) => {
                    const pct = v.received > 0 ? (v.issued / v.received) * 100 : 0;
                    return (
                      <tr
                        key={pid}
                        className="border-b border-border last:border-0 hover:bg-secondary/50"
                      >
                        <td className="py-2.5 pr-4 font-medium">
                          {dashboard.projectName.get(pid) ?? "Project"}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-numeric">
                          {v.received.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-numeric">
                          {v.issued.toLocaleString("en-IN")}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-numeric">{pct.toFixed(0)}%</td>
                        <td className="py-2.5 text-right text-numeric">{inr(v.issVal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="diary" className="space-y-4 pt-4">
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="max-w-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(query.data?.projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {reports.length === 0 ? (
        <EmptyState
          title="No site reports yet"
          description="Log the first daily report to start the site diary for this project."
        />
      ) : (
        <ul className="space-y-3">
          {reports.map((r) => {
            const labour = attendanceTotals(r.labour_attendance ?? []);
            return (
              <li key={r.id}>
                <Link
                  to="/site/$reportId"
                  params={{ reportId: r.id }}
                  className="block rounded-xl border border-border bg-card p-4 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {r.projects?.project_code} · {shortDate(r.report_date)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.projects?.name} · {r.employees?.full_name ?? "Unassigned"} ·{" "}
                        {titleCase(r.weather ?? "")}
                        {r.temperature_c ? ` ${Number(r.temperature_c).toFixed(0)}°C` : ""}
                      </p>
                    </div>
                    <StatusBadge value={r.approval_state} />
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm">{r.work_done}</p>
                  {r.blockers ? (
                    <p className="mt-2 text-sm text-destructive">Blocker: {r.blockers}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="text-numeric">
                      {labour.present}/{labour.planned} crew
                    </span>
                    <span className="text-numeric">
                      {Number(r.progress_percent ?? 0).toFixed(0)}% progress
                    </span>
                    <span>{(r.site_photos ?? []).length} photos</span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {formatCoords(r.latitude, r.longitude)}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function NewReportDialog({
  projects,
  pending,
  onSubmit,
}: {
  projects: { id: string; name: string; project_code: string }[];
  pending: boolean;
  onSubmit: (v: {
    projectId: string;
    reportDate: string;
    weather: string;
    temperature: string;
    workDone: string;
    plannedNext: string;
    blockers: string;
    progress: string;
    coords: Coords | null;
  }) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [weather, setWeather] = useState("clear");
  const [temperature, setTemperature] = useState("");
  const [workDone, setWorkDone] = useState("");
  const [plannedNext, setPlannedNext] = useState("");
  const [blockers, setBlockers] = useState("");
  const [progress, setProgress] = useState("");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  async function grabLocation() {
    setLocating(true);
    try {
      setCoords(await captureLocation());
      toast.success("Location captured");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Daily site report</DialogTitle>
        <DialogDescription>
          Written at site, so keep it to what actually happened today.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sr-date">Date</Label>
          <Input
            id="sr-date"
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Weather</Label>
          <Select value={weather} onValueChange={setWeather}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WEATHER_OPTIONS.map((w) => (
                <SelectItem key={w} value={w}>
                  {titleCase(w)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sr-temp">Temperature (°C)</Label>
          <Input
            id="sr-temp"
            type="number"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="sr-progress">Progress recorded (%)</Label>
          <Input
            id="sr-progress"
            type="number"
            value={progress}
            onChange={(e) => setProgress(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="sr-work">Work done today</Label>
          <Textarea
            id="sr-work"
            rows={3}
            value={workDone}
            onChange={(e) => setWorkDone(e.target.value)}
            placeholder="Areas covered, quantities, crews deployed."
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="sr-next">Planned tomorrow</Label>
          <Textarea
            id="sr-next"
            rows={2}
            value={plannedNext}
            onChange={(e) => setPlannedNext(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="sr-block">Blockers</Label>
          <Textarea
            id="sr-block"
            rows={2}
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            placeholder="Anything holding the crew up — leave blank if the day ran clean."
          />
        </div>
        <div className="sm:col-span-2">
          <Button type="button" variant="outline" onClick={grabLocation} disabled={locating}>
            <MapPin className="mr-2 h-4 w-4" />
            {locating ? "Locating…" : "Capture site location"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {coords
              ? `${formatCoords(coords.latitude, coords.longitude)} · ±${coords.accuracy.toFixed(0)} m`
              : "Optional, but it stamps the report to the actual site."}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !projectId || !workDone.trim()}
          onClick={() =>
            onSubmit({
              projectId,
              reportDate,
              weather,
              temperature,
              workDone: workDone.trim(),
              plannedNext: plannedNext.trim(),
              blockers: blockers.trim(),
              progress,
              coords,
            })
          }
        >
          {pending ? "Saving…" : "Submit report"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

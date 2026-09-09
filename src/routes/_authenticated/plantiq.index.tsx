import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Leaf, TriangleAlert } from "lucide-react";
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
import { pct, shortDate, titleCase } from "@/lib/format";
import {
  CHECK_SEVERITIES,
  batchAvailable,
  survivalPercent,
} from "@/lib/plantiq";

export const Route = createFileRoute("/_authenticated/plantiq/")({
  head: () => ({
    meta: [
      { title: "PlantIQ — species intelligence and plant health" },
      {
        name: "description",
        content:
          "Species care schedules, survival tracking and live plant health alerts across every landscape project, built on real nursery and site records.",
      },
      { property: "og:title", content: "PlantIQ — EnvironIQ" },
      {
        property: "og:description",
        content: "Care schedules, survival rates and plant health alerts from real site records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlantIqPage,
});

function PlantIqPage() {
  const { can, employee } = useAuth();
  const canEdit = can("plantiq", "edit");
  const queryClient = useQueryClient();
  const [openCheck, setOpenCheck] = useState(false);
  const [term, setTerm] = useState("");

  const query = useQuery({
    queryKey: ["plantiq"],
    queryFn: async () => {
      const [species, schedules, checks, batches, plantings, projects] = await Promise.all([
        supabase
          .from("plant_species")
          .select(
            "id, botanical_name, common_name, category, sunlight, water_need, maintenance_level, mature_height_m, native_region",
          )
          .order("botanical_name"),
        supabase
          .from("plant_care_schedules")
          .select("id, species_id, task_type, frequency_days, season, instruction")
          .order("frequency_days"),
        supabase
          .from("plant_health_checks")
          .select(
            "id, project_id, batch_id, species_id, check_date, sample_size, healthy_count, issue, severity, action_taken, plant_species(botanical_name), projects(project_code), employees(full_name)",
          )
          .order("check_date", { ascending: false })
          .limit(80),
        supabase
          .from("nursery_batches")
          .select("id, species_id, quantity_received, quantity_mortality, unit_cost, project_id")
          .eq("is_archived", false),
        supabase.from("plantings").select("id, batch_id, species_id, project_id, quantity"),
        supabase
          .from("projects")
          .select("id, name, project_code")
          .eq("is_archived", false)
          .order("project_code"),
      ]);
      for (const r of [species, schedules, checks, batches, plantings, projects]) {
        if (r.error) throw r.error;
      }
      return {
        species: species.data ?? [],
        schedules: schedules.data ?? [],
        checks: checks.data ?? [],
        batches: batches.data ?? [],
        plantings: plantings.data ?? [],
        projects: projects.data ?? [],
      };
    },
  });

  const addCheck = useMutation({
    mutationFn: async (v: {
      projectId: string;
      speciesId: string;
      checkDate: string;
      sample: string;
      healthy: string;
      issue: string;
      severity: string;
      action: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("plant_health_checks").insert({
        company_id: employee.company_id,
        project_id: v.projectId || null,
        species_id: v.speciesId,
        check_date: v.checkDate,
        inspected_by: employee.id,
        sample_size: Number(v.sample || 0),
        healthy_count: Number(v.healthy || 0),
        issue: v.issue || null,
        severity: v.severity,
        action_taken: v.action || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Health check logged");
      setOpenCheck(false);
      void queryClient.invalidateQueries({ queryKey: ["plantiq"] });
      void queryClient.invalidateQueries({ queryKey: ["nursery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const speciesRows = useMemo(() => {
    const list = query.data?.species ?? [];
    const needle = term.trim().toLowerCase();
    return list.filter((s) =>
      `${s.botanical_name} ${s.common_name ?? ""} ${s.category ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query.data, term]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const checks = query.data?.checks ?? [];
  const batches = query.data?.batches ?? [];
  const plantings = query.data?.plantings ?? [];
  const openAlerts = checks.filter((c) => c.severity !== "low" && !c.action_taken).length;
  const attention = checks.filter((c) => c.severity === "high").length;
  const sampled = checks.reduce((s, c) => s + Number(c.sample_size ?? 0), 0);
  const healthy = checks.reduce((s, c) => s + Number(c.healthy_count ?? 0), 0);
  const overallSurvival = sampled > 0 ? (healthy / sampled) * 100 : 100;
  const speciesUnderCare = new Set([
    ...plantings.map((p) => p.species_id),
    ...batches.map((b) => b.species_id),
  ]).size;

  return (
    <>
      <PageHeader
        title="PlantIQ"
        description="What each species needs, how it is actually doing on site, and where the crew has to step in — read straight from nursery batches, plantings and site health checks."
        actions={
          canEdit ? (
            <Dialog open={openCheck} onOpenChange={setOpenCheck}>
              <DialogTrigger asChild>
                <Button>
                  <Leaf className="mr-2 h-4 w-4" />
                  Log health check
                </Button>
              </DialogTrigger>
              <HealthCheckDialog
                species={query.data?.species ?? []}
                projects={query.data?.projects ?? []}
                pending={addCheck.isPending}
                onSubmit={(v) => addCheck.mutate(v)}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Species under care" value={String(speciesUnderCare)} />
        <StatCard
          label="Survival on inspection"
          value={pct(overallSurvival)}
          tone={overallSurvival < 90 ? "warning" : "success"}
        />
        <StatCard
          label="Open issues"
          value={String(openAlerts)}
          tone={openAlerts > 0 ? "warning" : "default"}
        />
        <StatCard
          label="High severity"
          value={String(attention)}
          tone={attention > 0 ? "danger" : "default"}
          icon={<TriangleAlert className="h-4 w-4" />}
        />
      </div>

      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Plant health</TabsTrigger>
          <TabsTrigger value="care">Care schedules</TabsTrigger>
          <TabsTrigger value="species">Species intelligence</TabsTrigger>
        </TabsList>

        <TabsContent value="health" className="space-y-3 pt-4">
          {checks.length === 0 ? (
            <EmptyState
              title="No health checks recorded"
              description="Log the first inspection to start tracking survival by species and project."
            />
          ) : (
            checks.map((c) => {
              const survival = survivalPercent(c.sample_size, c.healthy_count);
              return (
                <article key={c.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium italic">{c.plant_species?.botanical_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {c.projects?.project_code ?? "Nursery"} · {shortDate(c.check_date)} ·{" "}
                        {c.employees?.full_name ?? "Unassigned"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={c.severity} />
                      <span
                        className={`text-numeric text-sm font-medium ${survival < 90 ? "text-destructive" : "text-success"}`}
                      >
                        {pct(survival)} healthy
                      </span>
                    </div>
                  </div>
                  {c.issue ? <p className="mt-2 text-sm">{c.issue}</p> : null}
                  {c.action_taken ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Action: {c.action_taken}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-warning-foreground">No action recorded yet</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Sample {Number(c.sample_size ?? 0)} · healthy {Number(c.healthy_count ?? 0)}
                  </p>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="care" className="pt-4">
          {(query.data?.schedules ?? []).length === 0 ? (
            <EmptyState title="No care schedules yet" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {speciesRows
                .filter((s) => (query.data?.schedules ?? []).some((sc) => sc.species_id === s.id))
                .map((s) => (
                  <article key={s.id} className="rounded-xl border border-border bg-card p-4">
                    <p className="font-display text-base font-semibold italic">
                      {s.botanical_name}
                    </p>
                    <p className="text-xs text-muted-foreground">{s.common_name}</p>
                    <ul className="mt-3 space-y-2">
                      {(query.data?.schedules ?? [])
                        .filter((sc) => sc.species_id === s.id)
                        .map((sc) => (
                          <li key={sc.id} className="rounded-lg bg-secondary/40 p-3 text-sm">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{titleCase(sc.task_type)}</span>
                              <span className="text-numeric text-xs text-muted-foreground">
                                every {sc.frequency_days} d · {titleCase(sc.season)}
                              </span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{sc.instruction}</p>
                          </li>
                        ))}
                    </ul>
                  </article>
                ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="species" className="space-y-4 pt-4">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search botanical or common name…"
            className="max-w-sm"
          />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {speciesRows.map((s) => {
              const stock = batches
                .filter((b) => b.species_id === s.id)
                .reduce((sum, b) => sum + batchAvailable(b, plantings), 0);
              const planted = plantings
                .filter((p) => p.species_id === s.id)
                .reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
              const speciesChecks = checks.filter((c) => c.species_id === s.id);
              const sSample = speciesChecks.reduce((x, c) => x + Number(c.sample_size ?? 0), 0);
              const sHealthy = speciesChecks.reduce((x, c) => x + Number(c.healthy_count ?? 0), 0);
              return (
                <article key={s.id} className="rounded-xl border border-border bg-card p-4">
                  <p className="font-display text-base font-semibold italic">{s.botanical_name}</p>
                  <p className="text-sm text-muted-foreground">{s.common_name}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    {[
                      ["Sunlight", titleCase(s.sunlight ?? "—")],
                      ["Water need", titleCase(s.water_need ?? "—")],
                      ["Maintenance", titleCase(s.maintenance_level ?? "—")],
                      ["Category", titleCase(s.category ?? "—")],
                      ["In nursery", stock.toLocaleString("en-IN")],
                      ["Planted", planted.toLocaleString("en-IN")],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="font-medium">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {sSample > 0
                      ? `Survival on inspection: ${pct((sHealthy / sSample) * 100)} across ${sSample} plants checked`
                      : "Not inspected yet"}
                  </p>
                </article>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function HealthCheckDialog({
  species,
  projects,
  pending,
  onSubmit,
}: {
  species: { id: string; botanical_name: string }[];
  projects: { id: string; name: string; project_code: string }[];
  pending: boolean;
  onSubmit: (v: {
    projectId: string;
    speciesId: string;
    checkDate: string;
    sample: string;
    healthy: string;
    issue: string;
    severity: string;
    action: string;
  }) => void;
}) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [speciesId, setSpeciesId] = useState(species[0]?.id ?? "");
  const [checkDate, setCheckDate] = useState(new Date().toISOString().slice(0, 10));
  const [sample, setSample] = useState("");
  const [healthy, setHealthy] = useState("");
  const [issue, setIssue] = useState("");
  const [severity, setSeverity] = useState("low");
  const [action, setAction] = useState("");

  return (
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Plant health check</DialogTitle>
        <DialogDescription>
          Record what was actually inspected on site — sample counted, not estimated.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue />
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
          <Label>Species</Label>
          <Select value={speciesId} onValueChange={setSpeciesId}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {species.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.botanical_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hc-date">Check date</Label>
          <Input
            id="hc-date"
            type="date"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={setSeverity}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHECK_SEVERITIES.map((s) => (
                <SelectItem key={s} value={s}>
                  {titleCase(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hc-sample">Plants checked</Label>
          <Input
            id="hc-sample"
            type="number"
            value={sample}
            onChange={(e) => setSample(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="hc-healthy">Healthy</Label>
          <Input
            id="hc-healthy"
            type="number"
            value={healthy}
            onChange={(e) => setHealthy(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="hc-issue">Issue seen</Label>
          <Textarea
            id="hc-issue"
            rows={2}
            value={issue}
            onChange={(e) => setIssue(e.target.value)}
            placeholder="Leave blank if the stand is clean."
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="hc-action">Action taken</Label>
          <Textarea
            id="hc-action"
            rows={2}
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button disabled={pending || !speciesId || !sample} onClick={() =>
          onSubmit({ projectId, speciesId, checkDate, sample, healthy, issue, severity, action })
        }>
          {pending ? "Saving…" : "Log check"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

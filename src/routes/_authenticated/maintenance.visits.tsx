import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/visits")({
  head: () => ({
    meta: [
      { title: "Visits — EnvironIQ" },
      {
        name: "description",
        content:
          "Every planned and completed visit across all sites, crew-assigned, with append-only completion logs.",
      },
      { property: "og:title", content: "Visits — EnvironIQ" },
      { property: "og:description", content: "Crew dispatch board and completion logging." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisitsPage,
});

const TASK_TYPES = ["preventive", "corrective", "emergency", "client_requested"];
const STATUS_FILTERS = [
  "open",
  "planned",
  "in_progress",
  "completed",
  "incomplete",
  "cancelled",
  "all",
];
const WEATHER_IMPACTS = ["none", "rain", "heat", "high_wind", "other"];

function VisitsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const canLog = can("care", "create") || canEdit;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [logTaskId, setLogTaskId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["maintenance-visits-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select(
          "id, title, task_type, status, planned_date, weather_impact, maintenance_sites(name), maintenance_crews(name), employees:assignee_employee_id(full_name)",
        )
        .order("planned_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const sitesQuery = useQuery({
    queryKey: ["maintenance-sites-lite"],
    enabled: createOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_sites")
        .select("id, name")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const crewsQuery = useQuery({
    queryKey: ["maintenance-crews-lite"],
    enabled: createOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_crews")
        .select("id, name")
        .eq("status", "active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-lite"],
    enabled: createOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const materialsQuery = useQuery({
    queryKey: ["materials-lite"],
    enabled: !!logTaskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, name, uom")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const equipmentQuery = useQuery({
    queryKey: ["maintenance-equipment-lite"],
    enabled: !!logTaskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_equipment")
        .select("id, equipment_code, equipment_type")
        .order("equipment_code");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      siteId: string;
      title: string;
      taskType: string;
      plannedDate: string;
      crewId: string;
      assigneeId: string;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("maintenance_tasks").insert({
        site_id: form.siteId,
        title: form.title.trim(),
        task_type: form.taskType,
        planned_date: form.plannedDate || new Date().toISOString().slice(0, 10),
        crew_id: form.crewId || null,
        assignee_employee_id: form.assigneeId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Visit created");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-visits-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logCompletion = useMutation({
    mutationFn: async (form: {
      taskId: string;
      reportedStatus: string;
      quantityCompleted: string;
      uom: string;
      materialsUsed: string;
      issueNotes: string;
      incompleteReason: string;
      weatherImpact: string;
      materialId: string;
      materialQty: string;
      equipmentId: string;
      equipmentHours: string;
    }) => {
      const now = new Date().toISOString();
      const { error: logError } = await supabase.from("maintenance_task_logs").insert({
        task_id: form.taskId,
        logged_by: employee?.id ?? null,
        reported_status: form.reportedStatus,
        checked_in_at: now,
        checked_out_at: form.reportedStatus === "completed" ? now : null,
        quantity_completed: form.quantityCompleted.trim() ? Number(form.quantityCompleted) : null,
        uom: form.uom.trim() || null,
        materials_used: form.materialsUsed.trim() || null,
        issue_notes: form.issueNotes.trim() || null,
        incomplete_reason: form.incompleteReason.trim() || null,
      });
      if (logError) throw logError;

      const { error: taskError } = await supabase
        .from("maintenance_tasks")
        .update({
          status: form.reportedStatus,
          actual_start_time: now,
          actual_end_time: form.reportedStatus === "completed" ? now : null,
          weather_impact: form.weatherImpact === "none" ? null : form.weatherImpact,
        })
        .eq("id", form.taskId);
      if (taskError) throw taskError;

      if (form.materialId && form.materialQty.trim()) {
        const { error } = await supabase.from("maintenance_material_usage").insert({
          task_id: form.taskId,
          material_id: form.materialId,
          quantity_used: Number(form.materialQty),
        });
        if (error) throw error;
      }
      if (form.equipmentId && form.equipmentHours.trim()) {
        const { error } = await supabase.from("maintenance_equipment_usage").insert({
          task_id: form.taskId,
          equipment_id: form.equipmentId,
          hours_used: Number(form.equipmentHours),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Completion logged");
      setLogTaskId(null);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-visits-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((t) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "open") return ["planned", "in_progress"].includes(t.status);
    return t.status === statusFilter;
  });

  return (
    <>
      <PageHeader
        title="Visits"
        description="Every planned visit across all sites — logging a completion never rewrites the plan, it adds evidence."
        actions={
          canEdit ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>New visit</Button>
              </DialogTrigger>
              <NewVisitDialog
                sites={sitesQuery.data ?? []}
                crews={crewsQuery.data ?? []}
                employees={employeesQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(f) => create.mutate(f)}
              />
            </Dialog>
          ) : null
        }
      />

      <Select value={statusFilter} onValueChange={setStatusFilter}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUS_FILTERS.map((s) => (
            <SelectItem key={s} value={s}>
              {titleCase(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {rows.length === 0 ? (
        <EmptyState
          title="No visits in this view"
          description="Change the filter or create a visit."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Visit</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Crew</th>
                <th className="px-4 py-2 font-medium">Planned</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canLog ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{t.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(t.task_type)}
                      {t.weather_impact ? ` · ${titleCase(t.weather_impact)}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.maintenance_sites?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.maintenance_crews?.name ?? t.employees?.full_name ?? "Unassigned"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{shortDate(t.planned_date)}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={t.status} />
                  </td>
                  {canLog ? (
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setLogTaskId(t.id)}>
                        Log
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {logTaskId ? (
        <LogCompletionDialog
          taskId={logTaskId}
          materials={materialsQuery.data ?? []}
          equipment={equipmentQuery.data ?? []}
          pending={logCompletion.isPending}
          onOpenChange={(open) => !open && setLogTaskId(null)}
          onSubmit={(form) => logCompletion.mutate(form)}
        />
      ) : null}
    </>
  );
}

function NewVisitDialog({
  sites,
  crews,
  employees,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  crews: { id: string; name: string }[];
  employees: { id: string; full_name: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    title: string;
    taskType: string;
    plannedDate: string;
    crewId: string;
    assigneeId: string;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("preventive");
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().slice(0, 10));
  const [crewId, setCrewId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>New visit</DialogTitle>
        <DialogDescription>
          A single planned unit of work — for a recurring plan, generate one per visit from a
          service plan (schedule) instead.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Site</Label>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="visit-title">Title</Label>
          <Input
            id="visit-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Weekly lawn mowing — front lawn"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TASK_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="visit-date">Planned date</Label>
            <Input
              id="visit-date"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Crew (optional)</Label>
          <Select value={crewId} onValueChange={setCrewId}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {crews.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Assignee / point of contact (optional)</Label>
          <Select value={assigneeId} onValueChange={setAssigneeId}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !siteId || !title.trim()}
          onClick={() =>
            onSubmit({ siteId, title: title.trim(), taskType, plannedDate, crewId, assigneeId })
          }
        >
          {pending ? "Creating…" : "Create visit"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LogCompletionDialog({
  taskId,
  materials,
  equipment,
  pending,
  onOpenChange,
  onSubmit,
}: {
  taskId: string;
  materials: { id: string; name: string; uom: string }[];
  equipment: { id: string; equipment_code: string; equipment_type: string }[];
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: {
    taskId: string;
    reportedStatus: string;
    quantityCompleted: string;
    uom: string;
    materialsUsed: string;
    issueNotes: string;
    incompleteReason: string;
    weatherImpact: string;
    materialId: string;
    materialQty: string;
    equipmentId: string;
    equipmentHours: string;
  }) => void;
}) {
  const [reportedStatus, setReportedStatus] = useState("completed");
  const [quantityCompleted, setQuantityCompleted] = useState("");
  const [uom, setUom] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [incompleteReason, setIncompleteReason] = useState("");
  const [weatherImpact, setWeatherImpact] = useState("none");
  const [materialId, setMaterialId] = useState("");
  const [materialQty, setMaterialQty] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const [equipmentHours, setEquipmentHours] = useState("");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log completion</DialogTitle>
          <DialogDescription>
            This adds evidence against the visit — it never overwrites the plan or an earlier entry.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={reportedStatus} onValueChange={setReportedStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="in_progress">In progress</SelectItem>
                <SelectItem value="incomplete">Unable to complete</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="log-qty">Quantity completed</Label>
              <Input
                id="log-qty"
                inputMode="decimal"
                value={quantityCompleted}
                onChange={(e) => setQuantityCompleted(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="log-uom">Unit</Label>
              <Input id="log-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Weather</Label>
            <Select value={weatherImpact} onValueChange={setWeatherImpact}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WEATHER_IMPACTS.map((w) => (
                  <SelectItem key={w} value={w}>
                    {titleCase(w)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="log-materials">Materials used (notes)</Label>
            <Input
              id="log-materials"
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Material logged (optional)</Label>
              <Select value={materialId} onValueChange={setMaterialId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="log-material-qty">Quantity</Label>
              <Input
                id="log-material-qty"
                inputMode="decimal"
                value={materialQty}
                onChange={(e) => setMaterialQty(e.target.value)}
                disabled={!materialId}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Equipment used (optional)</Label>
              <Select value={equipmentId} onValueChange={setEquipmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {equipment.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.equipment_code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="log-equipment-hours">Hours</Label>
              <Input
                id="log-equipment-hours"
                inputMode="decimal"
                value={equipmentHours}
                onChange={(e) => setEquipmentHours(e.target.value)}
                disabled={!equipmentId}
              />
            </div>
          </div>
          {reportedStatus === "incomplete" ? (
            <div className="grid gap-2">
              <Label htmlFor="log-incomplete">
                Reason (rain, access, stock, staffing, equipment…)
              </Label>
              <Input
                id="log-incomplete"
                value={incompleteReason}
                onChange={(e) => setIncompleteReason(e.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label htmlFor="log-notes">Issue / safety notes (optional)</Label>
            <Textarea
              id="log-notes"
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              onSubmit({
                taskId,
                reportedStatus,
                quantityCompleted,
                uom,
                materialsUsed,
                issueNotes,
                incompleteReason,
                weatherImpact,
                materialId,
                materialQty,
                equipmentId,
                equipmentHours,
              })
            }
          >
            {pending ? "Saving…" : "Save log"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

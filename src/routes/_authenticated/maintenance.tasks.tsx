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

export const Route = createFileRoute("/_authenticated/maintenance/tasks")({
  head: () => ({
    meta: [
      { title: "Maintenance Tasks — EnvironIQ" },
      {
        name: "description",
        content:
          "Every planned maintenance task across all sites, with append-only completion logs.",
      },
      { property: "og:title", content: "Maintenance Tasks — EnvironIQ" },
      { property: "og:description", content: "Crew task board and completion logging." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceTasksPage,
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

function MaintenanceTasksPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const canLog = can("care", "create") || canEdit;
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [logTaskId, setLogTaskId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["maintenance-tasks-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select(
          "id, title, task_type, status, planned_date, maintenance_sites(name), employees:assignee_employee_id(full_name)",
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

  const create = useMutation({
    mutationFn: async (form: {
      siteId: string;
      title: string;
      taskType: string;
      plannedDate: string;
      assigneeId: string;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("maintenance_tasks").insert({
        site_id: form.siteId,
        title: form.title.trim(),
        task_type: form.taskType,
        planned_date: form.plannedDate || new Date().toISOString().slice(0, 10),
        assignee_employee_id: form.assigneeId || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Task created");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-tasks-all"] });
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
    }) => {
      const { error: logError } = await supabase.from("maintenance_task_logs").insert({
        task_id: form.taskId,
        logged_by: employee?.id ?? null,
        reported_status: form.reportedStatus,
        checked_in_at: new Date().toISOString(),
        quantity_completed: form.quantityCompleted.trim() ? Number(form.quantityCompleted) : null,
        uom: form.uom.trim() || null,
        materials_used: form.materialsUsed.trim() || null,
        issue_notes: form.issueNotes.trim() || null,
        incomplete_reason: form.incompleteReason.trim() || null,
      });
      if (logError) throw logError;
      const { error: taskError } = await supabase
        .from("maintenance_tasks")
        .update({ status: form.reportedStatus })
        .eq("id", form.taskId);
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success("Completion logged");
      setLogTaskId(null);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-tasks-all"] });
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
        title="Maintenance Tasks"
        description="Every planned task across all sites — logging a completion never rewrites the plan, it adds evidence."
        actions={
          canEdit ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>New task</Button>
              </DialogTrigger>
              <NewTaskDialog
                sites={sitesQuery.data ?? []}
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
          title="No tasks in this view"
          description="Change the filter or create a task."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Task</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Assignee</th>
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
                    <p className="text-xs text-muted-foreground">{titleCase(t.task_type)}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.maintenance_sites?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.employees?.full_name ?? "—"}
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
          pending={logCompletion.isPending}
          onOpenChange={(open) => !open && setLogTaskId(null)}
          onSubmit={(form) => logCompletion.mutate(form)}
        />
      ) : null}
    </>
  );
}

function NewTaskDialog({
  sites,
  employees,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  employees: { id: string; full_name: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    title: string;
    taskType: string;
    plannedDate: string;
    assigneeId: string;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("preventive");
  const [plannedDate, setPlannedDate] = useState(new Date().toISOString().slice(0, 10));
  const [assigneeId, setAssigneeId] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>New task</DialogTitle>
        <DialogDescription>
          A single planned unit of work — for a recurring plan, generate one per visit from a
          service template later.
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
          <Label htmlFor="task-title">Title</Label>
          <Input
            id="task-title"
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
            <Label htmlFor="task-date">Planned date</Label>
            <Input
              id="task-date"
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Assignee (optional)</Label>
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
            onSubmit({ siteId, title: title.trim(), taskType, plannedDate, assigneeId })
          }
        >
          {pending ? "Creating…" : "Create task"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LogCompletionDialog({
  taskId,
  pending,
  onOpenChange,
  onSubmit,
}: {
  taskId: string;
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
  }) => void;
}) {
  const [reportedStatus, setReportedStatus] = useState("completed");
  const [quantityCompleted, setQuantityCompleted] = useState("");
  const [uom, setUom] = useState("");
  const [materialsUsed, setMaterialsUsed] = useState("");
  const [issueNotes, setIssueNotes] = useState("");
  const [incompleteReason, setIncompleteReason] = useState("");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log completion</DialogTitle>
          <DialogDescription>
            This adds evidence against the task — it never overwrites the plan or an earlier entry.
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
            <Label htmlFor="log-materials">Materials used</Label>
            <Input
              id="log-materials"
              value={materialsUsed}
              onChange={(e) => setMaterialsUsed(e.target.value)}
            />
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

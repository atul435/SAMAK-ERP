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

export const Route = createFileRoute("/_authenticated/maintenance/schedules")({
  head: () => ({
    meta: [
      { title: "Maintenance Schedules — EnvironIQ" },
      {
        name: "description",
        content: "Recurring visit plans per site and zone — generate a task for today from one.",
      },
      { property: "og:title", content: "Maintenance Schedules — EnvironIQ" },
      { property: "og:description", content: "The recurring plan tasks are generated from." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceSchedulesPage,
});

const FREQUENCIES = ["weekly", "biweekly", "monthly", "quarterly", "seasonal", "one_off"];
const STATUSES = ["active", "paused", "ended"];

function MaintenanceSchedulesPage() {
  const { can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-schedules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_schedules")
        .select(
          "id, frequency, start_date, end_date, status, assigned_crew, assigned_employee_id, site_id, zone_id, service_template_id, maintenance_sites(name), maintenance_zones(name), service_templates(name), employees:assigned_employee_id(full_name)",
        )
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const sitesQuery = useQuery({
    queryKey: ["maintenance-sites-lite"],
    enabled: open,
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

  const zonesQuery = useQuery({
    queryKey: ["maintenance-zones-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_zones")
        .select("id, name, site_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const templatesQuery = useQuery({
    queryKey: ["service-templates-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_templates")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-lite"],
    enabled: open,
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
      zoneId: string;
      serviceTemplateId: string;
      frequency: string;
      startDate: string;
      assignedEmployeeId: string;
      assignedCrew: string;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("maintenance_schedules").insert({
        site_id: form.siteId,
        zone_id: form.zoneId || null,
        service_template_id: form.serviceTemplateId || null,
        frequency: form.frequency,
        start_date: form.startDate || new Date().toISOString().slice(0, 10),
        assigned_employee_id: form.assignedEmployeeId || null,
        assigned_crew: form.assignedCrew.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-schedules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("maintenance_schedules")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["maintenance-schedules"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const generateTask = useMutation({
    mutationFn: async (schedule: {
      id: string;
      site_id: string;
      zone_id: string | null;
      service_template_id: string | null;
      assigned_employee_id_value: string | null;
      title: string;
    }) => {
      const { error } = await supabase.from("maintenance_tasks").insert({
        site_id: schedule.site_id,
        zone_id: schedule.zone_id,
        schedule_id: schedule.id,
        service_template_id: schedule.service_template_id,
        task_type: "preventive",
        title: schedule.title,
        planned_date: new Date().toISOString().slice(0, 10),
        assignee_employee_id: schedule.assigned_employee_id_value,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Visit generated for today — see Maintenance → Visits"),
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Maintenance Schedules"
        description="The recurring plan behind each site's visits. Generating a task never edits the schedule — it adds a new planned task for today."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add schedule</Button>
              </DialogTrigger>
              <NewScheduleDialog
                sites={sitesQuery.data ?? []}
                zones={zonesQuery.data ?? []}
                templates={templatesQuery.data ?? []}
                employees={employeesQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(f) => create.mutate(f)}
              />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No schedules yet"
          description="Add a schedule to define the recurring visit plan for a site or zone."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Site / zone</th>
                <th className="px-4 py-2 font-medium">Work</th>
                <th className="px-4 py-2 font-medium">Frequency</th>
                <th className="px-4 py-2 font-medium">Assigned</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canEdit ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{s.maintenance_sites?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.maintenance_zones?.name ?? "Whole site"}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {s.service_templates?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{titleCase(s.frequency)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {s.employees?.full_name ?? s.assigned_crew ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <Select
                        value={s.status}
                        onValueChange={(status) => setStatus.mutate({ id: s.id, status })}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((st) => (
                            <SelectItem key={st} value={st}>
                              {titleCase(st)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge value={s.status} />
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={generateTask.isPending || s.status !== "active"}
                        onClick={() =>
                          generateTask.mutate({
                            id: s.id,
                            site_id: s.site_id,
                            zone_id: s.zone_id,
                            service_template_id: s.service_template_id,
                            assigned_employee_id_value: s.assigned_employee_id,
                            title: `${s.service_templates?.name ?? "Scheduled visit"} — ${s.maintenance_sites?.name ?? ""}`,
                          })
                        }
                      >
                        Generate visit
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewScheduleDialog({
  sites,
  zones,
  templates,
  employees,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  zones: { id: string; name: string; site_id: string }[];
  templates: { id: string; name: string }[];
  employees: { id: string; full_name: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    zoneId: string;
    serviceTemplateId: string;
    frequency: string;
    startDate: string;
    assignedEmployeeId: string;
    assignedCrew: string;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [serviceTemplateId, setServiceTemplateId] = useState("");
  const [frequency, setFrequency] = useState("weekly");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [assignedEmployeeId, setAssignedEmployeeId] = useState("");
  const [assignedCrew, setAssignedCrew] = useState("");

  const relevantZones = zones.filter((z) => !siteId || z.site_id === siteId);

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add schedule</DialogTitle>
        <DialogDescription>
          The recurring plan for a site or zone — generate a task from it whenever a visit is due.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Site</Label>
          <Select
            value={siteId}
            onValueChange={(v) => {
              setSiteId(v);
              setZoneId("");
            }}
          >
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
          <Label>Zone (optional)</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger>
              <SelectValue placeholder="Whole site" />
            </SelectTrigger>
            <SelectContent>
              {relevantZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Work (service template, optional)</Label>
          <Select value={serviceTemplateId} onValueChange={setServiceTemplateId}>
            <SelectTrigger>
              <SelectValue placeholder="Not linked to a template" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f} value={f}>
                    {titleCase(f)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="sched-start">Start date</Label>
            <Input
              id="sched-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label>Assigned employee (optional)</Label>
          <Select value={assignedEmployeeId} onValueChange={setAssignedEmployeeId}>
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
        <div className="grid gap-2">
          <Label htmlFor="sched-crew">Or a crew name</Label>
          <Input
            id="sched-crew"
            value={assignedCrew}
            onChange={(e) => setAssignedCrew(e.target.value)}
            placeholder="Crew B"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !siteId}
          onClick={() =>
            onSubmit({
              siteId,
              zoneId,
              serviceTemplateId,
              frequency,
              startDate,
              assignedEmployeeId,
              assignedCrew,
            })
          }
        >
          {pending ? "Adding…" : "Add schedule"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

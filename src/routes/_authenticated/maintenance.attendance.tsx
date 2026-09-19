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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance & Timesheets — EnvironIQ" },
      {
        name: "description",
        content: "Daily crew attendance and hours worked, the basis for real job costing.",
      },
      { property: "og:title", content: "Attendance & Timesheets — EnvironIQ" },
      { property: "og:description", content: "Who worked, when, and for how long." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AttendanceTimesheetsPage,
});

const ATTENDANCE_STATUSES = ["present", "absent", "leave", "half_day"];

function AttendanceTimesheetsPage() {
  return (
    <>
      <PageHeader
        title="Attendance & Timesheets"
        description="Daily presence and hours worked per employee — the basis for real labour costing against a visit."
      />
      <Tabs defaultValue="attendance">
        <TabsList>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="timesheets">Timesheets</TabsTrigger>
        </TabsList>
        <TabsContent value="attendance">
          <AttendanceTab />
        </TabsContent>
        <TabsContent value="timesheets">
          <TimesheetsTab />
        </TabsContent>
      </Tabs>
    </>
  );
}

function AttendanceTab() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-attendance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_attendance")
        .select(
          "id, attendance_date, status, check_in_time, check_out_time, notes, employees(full_name)",
        )
        .order("attendance_date", { ascending: false })
        .limit(200);
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

  const mark = useMutation({
    mutationFn: async (form: {
      employeeId: string;
      attendanceDate: string;
      status: string;
      notes: string;
    }) => {
      if (!form.employeeId) throw new Error("Pick an employee.");
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const now = new Date().toISOString();
      const { error } = await supabase.from("maintenance_attendance").upsert(
        {
          company_id: employee.company_id,
          employee_id: form.employeeId,
          attendance_date: form.attendanceDate,
          status: form.status,
          check_in_time: form.status === "present" || form.status === "half_day" ? now : null,
          notes: form.notes.trim() || null,
        },
        { onConflict: "employee_id,attendance_date" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance marked");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Mark attendance</Button>
            </DialogTrigger>
            <MarkAttendanceDialog
              employees={employeesQuery.data ?? []}
              pending={mark.isPending}
              onSubmit={(f) => mark.mutate(f)}
            />
          </Dialog>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No attendance marked yet"
          description="Mark daily presence for crew members here."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{a.employees?.full_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {shortDate(a.attendance_date)}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={a.status} />
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{a.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MarkAttendanceDialog({
  employees,
  pending,
  onSubmit,
}: {
  employees: { id: string; full_name: string }[];
  pending: boolean;
  onSubmit: (form: {
    employeeId: string;
    attendanceDate: string;
    status: string;
    notes: string;
  }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState("present");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Mark attendance</DialogTitle>
        <DialogDescription>
          Marking the same employee and date again updates that day's record.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
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
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="att-date">Date</Label>
            <Input
              id="att-date"
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="att-notes">Notes</Label>
          <Textarea
            id="att-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !employeeId}
          onClick={() => onSubmit({ employeeId, attendanceDate, status, notes })}
        >
          {pending ? "Saving…" : "Mark attendance"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function TimesheetsTab() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-timesheets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_timesheets")
        .select(
          "id, work_date, hours_worked, overtime_hours, notes, employees(full_name), maintenance_tasks(title)",
        )
        .order("work_date", { ascending: false })
        .limit(200);
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

  const visitsQuery = useQuery({
    queryKey: ["maintenance-visits-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tasks")
        .select("id, title, planned_date")
        .order("planned_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const logHours = useMutation({
    mutationFn: async (form: {
      employeeId: string;
      taskId: string;
      workDate: string;
      hoursWorked: string;
      overtimeHours: string;
      notes: string;
    }) => {
      if (!form.employeeId) throw new Error("Pick an employee.");
      if (!form.hoursWorked.trim()) throw new Error("Enter hours worked.");
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { error } = await supabase.from("maintenance_timesheets").insert({
        company_id: employee.company_id,
        employee_id: form.employeeId,
        task_id: form.taskId || null,
        work_date: form.workDate,
        hours_worked: Number(form.hoursWorked),
        overtime_hours: form.overtimeHours.trim() ? Number(form.overtimeHours) : 0,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hours logged");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-timesheets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canEdit ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Log hours</Button>
            </DialogTrigger>
            <LogHoursDialog
              employees={employeesQuery.data ?? []}
              visits={visitsQuery.data ?? []}
              pending={logHours.isPending}
              onSubmit={(f) => logHours.mutate(f)}
            />
          </Dialog>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          title="No hours logged yet"
          description="Log hours worked per employee, optionally against a specific visit."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 font-medium">Visit</th>
                <th className="px-4 py-2 text-right font-medium">Hours</th>
                <th className="px-4 py-2 text-right font-medium">Overtime</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 font-medium">{t.employees?.full_name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{shortDate(t.work_date)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.maintenance_tasks?.title ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">{t.hours_worked}</td>
                  <td className="px-4 py-2.5 text-right text-numeric text-muted-foreground">
                    {t.overtime_hours || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LogHoursDialog({
  employees,
  visits,
  pending,
  onSubmit,
}: {
  employees: { id: string; full_name: string }[];
  visits: { id: string; title: string }[];
  pending: boolean;
  onSubmit: (form: {
    employeeId: string;
    taskId: string;
    workDate: string;
    hoursWorked: string;
    overtimeHours: string;
    notes: string;
  }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [workDate, setWorkDate] = useState(new Date().toISOString().slice(0, 10));
  const [hoursWorked, setHoursWorked] = useState("");
  const [overtimeHours, setOvertimeHours] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Log hours</DialogTitle>
        <DialogDescription>Optionally link the hours to the visit they were for.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Employee</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select employee" />
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
          <Label>Visit (optional)</Label>
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger>
              <SelectValue placeholder="Not linked to a visit" />
            </SelectTrigger>
            <SelectContent>
              {visits.map((v) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ts-date">Date</Label>
            <Input
              id="ts-date"
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ts-hours">Hours</Label>
            <Input
              id="ts-hours"
              inputMode="decimal"
              value={hoursWorked}
              onChange={(e) => setHoursWorked(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ts-overtime">Overtime</Label>
            <Input
              id="ts-overtime"
              inputMode="decimal"
              value={overtimeHours}
              onChange={(e) => setOvertimeHours(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ts-notes">Notes</Label>
          <Textarea
            id="ts-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !employeeId || !hoursWorked.trim()}
          onClick={() =>
            onSubmit({ employeeId, taskId, workDate, hoursWorked, overtimeHours, notes })
          }
        >
          {pending ? "Saving…" : "Log hours"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

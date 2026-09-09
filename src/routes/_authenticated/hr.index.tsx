import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { StatusBadge } from "@/components/common/StatusBadge";
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
import { LEAVE_TYPES, inclusiveDays, payrollTotals, payslipTotals } from "@/lib/finance";

export const Route = createFileRoute("/_authenticated/hr/")({
  head: () => ({
    meta: [
      { title: "People — pay structure, payroll and leave" },
      {
        name: "description",
        content:
          "Employee pay structure, monthly payroll runs with payslip lines, project-charged salary cost and leave requests awaiting approval.",
      },
      { property: "og:title", content: "People — pay structure, payroll and leave" },
      {
        property: "og:description",
        content: "Run monthly payroll and manage leave for the whole landscape team.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HrPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function HrPage() {
  const { can, employee } = useAuth();
  const canEditHr = can("hr", "edit");
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState<string>("");
  const [openComp, setOpenComp] = useState(false);
  const [openLeave, setOpenLeave] = useState(false);

  const query = useQuery({
    queryKey: ["hr"],
    queryFn: async () => {
      const [employees, comp, runs, items, leave, projects] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, employee_code, primary_role, designation, email, date_of_joining")
          .eq("is_active", true)
          .order("employee_code"),
        supabase
          .from("employee_compensation")
          .select(
            "id, employee_id, effective_from, monthly_gross, basic, hra, allowances, pf_applicable, esi_applicable, bank_account_last4",
          )
          .order("effective_from", { ascending: false }),
        supabase
          .from("payroll_runs")
          .select("id, run_code, period_month, working_days, notes, status, approval_state")
          .order("period_month", { ascending: false }),
        supabase
          .from("payroll_items")
          .select(
            "id, payroll_run_id, employee_id, project_id, days_present, basic, hra, allowances, overtime, pf_deduction, esi_deduction, tds_deduction, other_deduction, employees(full_name, employee_code, primary_role), projects(project_code)",
          ),
        supabase
          .from("leave_requests")
          .select(
            "id, employee_id, leave_type, from_date, to_date, days, reason, approval_state, decision_note, employees!leave_requests_employee_id_fkey(full_name, employee_code)",
          )
          .order("from_date", { ascending: false }),
        supabase
          .from("projects")
          .select("id, project_code, name")
          .eq("is_archived", false)
          .order("project_code"),
      ]);
      for (const r of [employees, comp, runs, items, leave, projects]) if (r.error) throw r.error;
      return {
        employees: employees.data ?? [],
        comp: comp.data ?? [],
        runs: runs.data ?? [],
        items: items.data ?? [],
        leave: leave.data ?? [],
        projects: projects.data ?? [],
      };
    },
  });

  const saveComp = useMutation({
    mutationFn: async (v: {
      employeeId: string;
      effectiveFrom: string;
      gross: string;
      basic: string;
      hra: string;
      allowances: string;
      pf: string;
      esi: string;
      remarks: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("employee_compensation").insert({
        company_id: employee.company_id,
        employee_id: v.employeeId,
        effective_from: v.effectiveFrom,
        monthly_gross: Number(v.gross || 0),
        basic: Number(v.basic || 0),
        hra: Number(v.hra || 0),
        allowances: Number(v.allowances || 0),
        pf_applicable: v.pf === "yes",
        esi_applicable: v.esi === "yes",
        remarks: v.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pay structure saved");
      setOpenComp(false);
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const applyLeave = useMutation({
    mutationFn: async (v: {
      employeeId: string;
      leaveType: string;
      fromDate: string;
      toDate: string;
      reason: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("leave_requests").insert({
        company_id: employee.company_id,
        employee_id: v.employeeId || employee.id,
        leave_type: v.leaveType,
        from_date: v.fromDate,
        to_date: v.toDate,
        days: inclusiveDays(v.fromDate, v.toDate),
        reason: v.reason || null,
        approval_state: "submitted",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave request submitted");
      setOpenLeave(false);
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decideLeave = useMutation({
    mutationFn: async (v: { id: string; state: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("leave_requests")
        .update({
          approval_state: v.state,
          approver_id: employee?.id ?? null,
          decided_at: new Date().toISOString(),
        })
        .eq("id", v.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Leave decision recorded");
      void queryClient.invalidateQueries({ queryKey: ["hr"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeRunId = runId || query.data?.runs[0]?.id || "";
  const runItems = useMemo(
    () => (query.data?.items ?? []).filter((i) => i.payroll_run_id === activeRunId),
    [query.data, activeRunId],
  );

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  const data = query.data!;

  const latestComp = new Map<string, (typeof data.comp)[number]>();
  for (const c of data.comp) if (!latestComp.has(c.employee_id)) latestComp.set(c.employee_id, c);

  const monthlyCost = Array.from(latestComp.values()).reduce(
    (s, c) => s + Number(c.monthly_gross ?? 0),
    0,
  );
  const runTotals = payrollTotals(runItems);
  const pendingLeave = data.leave.filter(
    (l) => l.approval_state === "submitted" || l.approval_state === "pending_approval",
  );
  const activeRun = data.runs.find((r) => r.id === activeRunId);

  const projectSalary = new Map<string, number>();
  for (const i of runItems) {
    const key = i.projects?.project_code ?? "Overhead";
    projectSalary.set(key, (projectSalary.get(key) ?? 0) + payslipTotals(i).earnings);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="People"
        description="Pay structure, monthly payroll and leave for the whole team — salary cost charged back to the projects people work on."
        actions={
          canEditHr ? (
            <div className="flex flex-wrap items-center gap-2">
              <LeaveDialog
                open={openLeave}
                setOpen={setOpenLeave}
                employees={data.employees}
                onSubmit={(v) => applyLeave.mutate(v)}
                pending={applyLeave.isPending}
              />
              <CompDialog
                open={openComp}
                setOpen={setOpenComp}
                employees={data.employees}
                onSubmit={(v) => saveComp.mutate(v)}
                pending={saveComp.isPending}
              />
            </div>
          ) : (
            <LeaveDialog
              open={openLeave}
              setOpen={setOpenLeave}
              employees={data.employees}
              onSubmit={(v) => applyLeave.mutate(v)}
              pending={applyLeave.isPending}
              selfOnly={employee?.id ?? ""}
            />
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Team on roll"
          value={String(data.employees.length)}
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard label="Monthly salary bill" value={inr(monthlyCost, true)} />
        <StatCard
          label={activeRun ? `Net pay — ${shortDate(activeRun.period_month)}` : "Net pay"}
          value={inr(runTotals.net, true)}
          hint={`${runItems.length} payslips`}
        />
        <StatCard
          label="Leave awaiting action"
          value={String(pendingLeave.length)}
          tone={pendingLeave.length > 0 ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="payroll">
        <TabsList>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="pay">Pay structure</TabsTrigger>
          <TabsTrigger value="leave">Leave</TabsTrigger>
        </TabsList>

        <TabsContent value="payroll" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={activeRunId} onValueChange={setRunId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="Select payroll month" />
              </SelectTrigger>
              <SelectContent>
                {data.runs.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.run_code} — {shortDate(r.period_month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeRun ? <StatusBadge value={activeRun.approval_state} /> : null}
            {activeRun?.notes ? (
              <span className="text-sm text-muted-foreground">{activeRun.notes}</span>
            ) : null}
          </div>

          {projectSalary.size > 0 ? (
            <div className="flex flex-wrap gap-2">
              {Array.from(projectSalary.entries()).map(([code, amount]) => (
                <span
                  key={code}
                  className="rounded-full border border-border bg-card px-3 py-1 text-xs"
                >
                  {code}: <span className="text-numeric font-medium">{inr(amount, true)}</span>
                </span>
              ))}
            </div>
          ) : null}

          {runItems.length === 0 ? (
            <EmptyState title="No payslips in this run" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[980px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Charged to</th>
                    <th className="px-3 py-2 text-right">Days</th>
                    <th className="px-3 py-2 text-right">Basic</th>
                    <th className="px-3 py-2 text-right">HRA</th>
                    <th className="px-3 py-2 text-right">Allowances</th>
                    <th className="px-3 py-2 text-right">Deductions</th>
                    <th className="px-3 py-2 text-right">Net pay</th>
                  </tr>
                </thead>
                <tbody>
                  {runItems.map((i) => {
                    const t = payslipTotals(i);
                    return (
                      <tr key={i.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <span className="font-medium">{i.employees?.full_name}</span>
                          <p className="text-xs text-muted-foreground">
                            {i.employees?.employee_code} · {titleCase(i.employees?.primary_role)}
                          </p>
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {i.projects?.project_code ?? "Overhead"}
                        </td>
                        <td className="px-3 py-2 text-right text-numeric">
                          {Number(i.days_present ?? 0)}
                        </td>
                        <td className="px-3 py-2 text-right text-numeric">{inr(i.basic)}</td>
                        <td className="px-3 py-2 text-right text-numeric">{inr(i.hra)}</td>
                        <td className="px-3 py-2 text-right text-numeric">
                          {inr(Number(i.allowances ?? 0) + Number(i.overtime ?? 0))}
                        </td>
                        <td className="px-3 py-2 text-right text-numeric text-destructive">
                          -{inr(t.deductions)}
                        </td>
                        <td className="px-3 py-2 text-right text-numeric font-medium">
                          {inr(t.net)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="border-t border-border bg-muted/30 font-semibold">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right">
                      Run total
                    </td>
                    <td className="px-3 py-2 text-right text-numeric">
                      -{inr(runTotals.deductions)}
                    </td>
                    <td className="px-3 py-2 text-right text-numeric">{inr(runTotals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="pay" className="mt-4">
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Employee</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2">Effective</th>
                  <th className="px-3 py-2 text-right">Basic</th>
                  <th className="px-3 py-2 text-right">HRA</th>
                  <th className="px-3 py-2 text-right">Allowances</th>
                  <th className="px-3 py-2 text-right">Monthly gross</th>
                  <th className="px-3 py-2">Statutory</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((e) => {
                  const c = latestComp.get(e.id);
                  return (
                    <tr key={e.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium">{e.full_name}</span>
                        <p className="text-xs text-muted-foreground">{e.employee_code}</p>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {e.designation ?? titleCase(e.primary_role)}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c ? shortDate(c.effective_from) : "Not set"}
                      </td>
                      <td className="px-3 py-2 text-right text-numeric">{c ? inr(c.basic) : "—"}</td>
                      <td className="px-3 py-2 text-right text-numeric">{c ? inr(c.hra) : "—"}</td>
                      <td className="px-3 py-2 text-right text-numeric">
                        {c ? inr(c.allowances) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-numeric font-medium">
                        {c ? inr(c.monthly_gross) : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {c ? `${c.pf_applicable ? "PF" : "No PF"}${c.esi_applicable ? " · ESI" : ""}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          {data.leave.length === 0 ? (
            <EmptyState title="No leave requests" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[860px] text-sm">
                <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Dates</th>
                    <th className="px-3 py-2 text-right">Days</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">State</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {data.leave.map((l) => (
                    <tr key={l.id} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-medium">{l.employees?.full_name ?? "—"}</span>
                        <p className="text-xs text-muted-foreground">
                          {l.employees?.employee_code ?? ""}
                        </p>
                      </td>
                      <td className="px-3 py-2 text-xs">{titleCase(l.leave_type)}</td>
                      <td className="px-3 py-2 text-xs">
                        {shortDate(l.from_date)} → {shortDate(l.to_date)}
                      </td>
                      <td className="px-3 py-2 text-right text-numeric">{Number(l.days ?? 0)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{l.reason ?? "—"}</td>
                      <td className="px-3 py-2">
                        <StatusBadge value={l.approval_state} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {can("hr", "approve") &&
                        (l.approval_state === "submitted" ||
                          l.approval_state === "pending_approval") ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => decideLeave.mutate({ id: l.id, state: "rejected" })}
                            >
                              Decline
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => decideLeave.mutate({ id: l.id, state: "approved" })}
                            >
                              Approve
                            </Button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompDialog({
  open,
  setOpen,
  employees,
  onSubmit,
  pending,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  employees: { id: string; full_name: string; employee_code: string }[];
  onSubmit: (v: {
    employeeId: string;
    effectiveFrom: string;
    gross: string;
    basic: string;
    hra: string;
    allowances: string;
    pf: string;
    esi: string;
    remarks: string;
  }) => void;
  pending: boolean;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [gross, setGross] = useState("");
  const [basic, setBasic] = useState("");
  const [hra, setHra] = useState("");
  const [allowances, setAllowances] = useState("");
  const [pf, setPf] = useState("yes");
  const [esi, setEsi] = useState("no");
  const [remarks, setRemarks] = useState("");

  function splitGross(value: string) {
    setGross(value);
    const n = Number(value || 0);
    const b = Math.round(n * 0.5);
    const h = Math.round(n * 0.2);
    setBasic(String(b));
    setHra(String(h));
    setAllowances(String(n - b - h));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Set pay structure</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Set pay structure</DialogTitle>
          <DialogDescription>
            A new record from the effective date — earlier records stay as history.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.employee_code} — {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Effective from</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Monthly gross (₹)</Label>
            <Input type="number" value={gross} onChange={(e) => splitGross(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Basic (₹)</Label>
            <Input type="number" value={basic} onChange={(e) => setBasic(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>HRA (₹)</Label>
            <Input type="number" value={hra} onChange={(e) => setHra(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Other allowances (₹)</Label>
            <Input
              type="number"
              value={allowances}
              onChange={(e) => setAllowances(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Provident fund</Label>
            <Select value={pf} onValueChange={setPf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Applicable</SelectItem>
                <SelectItem value="no">Not applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>ESI</Label>
            <Select value={esi} onValueChange={setEsi}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="yes">Applicable</SelectItem>
                <SelectItem value="no">Not applicable</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Remarks</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !employeeId || !gross}
            onClick={() =>
              onSubmit({
                employeeId,
                effectiveFrom,
                gross,
                basic,
                hra,
                allowances,
                pf,
                esi,
                remarks,
              })
            }
          >
            {pending ? "Saving…" : "Save pay structure"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LeaveDialog({
  open,
  setOpen,
  employees,
  onSubmit,
  pending,
  selfOnly,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  employees: { id: string; full_name: string; employee_code: string }[];
  onSubmit: (v: {
    employeeId: string;
    leaveType: string;
    fromDate: string;
    toDate: string;
    reason: string;
  }) => void;
  pending: boolean;
  selfOnly?: string;
}) {
  const [employeeId, setEmployeeId] = useState(selfOnly ?? "");
  const [leaveType, setLeaveType] = useState("casual");
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());
  const [reason, setReason] = useState("");
  const days = inclusiveDays(fromDate, toDate);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Apply for leave</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Apply for leave</DialogTitle>
          <DialogDescription>The request goes to the approver for a decision.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {selfOnly ? null : (
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Employee</Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Me" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.employee_code} — {e.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Leave type</Label>
            <Select value={leaveType} onValueChange={setLeaveType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAVE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">
            {days} day{days === 1 ? "" : "s"} of leave.
          </p>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || days <= 0}
            onClick={() => onSubmit({ employeeId, leaveType, fromDate, toDate, reason })}
          >
            {pending ? "Saving…" : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

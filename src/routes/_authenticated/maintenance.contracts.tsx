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
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/contracts")({
  head: () => ({
    meta: [
      { title: "Maintenance Contracts — EnvironIQ" },
      {
        name: "description",
        content: "AMC, seasonal and project-based contracts: scope, SLAs, billing and obligations.",
      },
      { property: "og:title", content: "Maintenance Contracts — EnvironIQ" },
      { property: "og:description", content: "Every signed maintenance contract, in full." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceContractsPage,
});

const STATUSES = ["draft", "active", "expired", "terminated"];

type ContractDetails = {
  renewal_notice_days: string;
  escalation_clause: string;
  gst_percent: string;
  billing_terms: string;
  seasonal_allowance: string;
  plant_replacement_policy: string;
  response_sla_hours: string;
  resolution_sla_hours: string;
  working_hours: string;
  material_cap: string;
  equipment_responsibility: string;
  client_obligations: string;
  access_restrictions: string;
  approval_contact: string;
};

function MaintenanceContractsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["maintenance-contracts"] });

  const query = useQuery({
    queryKey: ["maintenance-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_contracts")
        .select(
          "id, contract_code, title, status, start_date, end_date, monthly_fee, frequency, response_sla_hours, resolution_sla_hours, billing_terms, gst_percent, renewal_notice_days, escalation_clause, seasonal_allowance, plant_replacement_policy, working_hours, material_cap, equipment_responsibility, client_obligations, access_restrictions, approval_contact, clients(name), maintenance_sites(id)",
        )
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      title: string;
      clientId: string;
      startDate: string;
      endDate: string;
      monthlyFee: string;
      frequency: string;
      responseSlaHours: string;
      resolutionSlaHours: string;
      gstPercent: string;
      billingTerms: string;
    }) => {
      if (!form.clientId) throw new Error("Pick a client.");
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("maintenance_contracts")
        .select("id", { count: "exact", head: true });
      const code = `AMC-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("maintenance_contracts").insert({
        company_id: employee.company_id,
        client_id: form.clientId,
        contract_code: code,
        title: form.title.trim(),
        start_date: form.startDate || null,
        end_date: form.endDate || null,
        monthly_fee: form.monthlyFee.trim() ? Number(form.monthlyFee) : null,
        frequency: form.frequency.trim() || null,
        response_sla_hours: form.responseSlaHours.trim() ? Number(form.responseSlaHours) : null,
        resolution_sla_hours: form.resolutionSlaHours.trim()
          ? Number(form.resolutionSlaHours)
          : null,
        gst_percent: form.gstPercent.trim() ? Number(form.gstPercent) : null,
        billing_terms: form.billingTerms.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contract added");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("maintenance_contracts")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDetails = useMutation({
    mutationFn: async ({ id, details }: { id: string; details: ContractDetails }) => {
      const { error } = await supabase
        .from("maintenance_contracts")
        .update({
          renewal_notice_days: details.renewal_notice_days.trim()
            ? Number(details.renewal_notice_days)
            : null,
          escalation_clause: details.escalation_clause.trim() || null,
          gst_percent: details.gst_percent.trim() ? Number(details.gst_percent) : null,
          billing_terms: details.billing_terms.trim() || null,
          seasonal_allowance: details.seasonal_allowance.trim() || null,
          plant_replacement_policy: details.plant_replacement_policy.trim() || null,
          response_sla_hours: details.response_sla_hours.trim()
            ? Number(details.response_sla_hours)
            : null,
          resolution_sla_hours: details.resolution_sla_hours.trim()
            ? Number(details.resolution_sla_hours)
            : null,
          working_hours: details.working_hours.trim() || null,
          material_cap: details.material_cap.trim() ? Number(details.material_cap) : null,
          equipment_responsibility: details.equipment_responsibility.trim() || null,
          client_obligations: details.client_obligations.trim() || null,
          access_restrictions: details.access_restrictions.trim() || null,
          approval_contact: details.approval_contact.trim() || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contract details saved");
      setEditId(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];
  const editing = rows.find((r) => r.id === editId);

  return (
    <>
      <PageHeader
        title="Maintenance Contracts"
        description="AMC, seasonal and project-based agreements — SLAs, billing terms and obligations, not just fee and dates."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add contract</Button>
              </DialogTrigger>
              <NewContractDialog
                clients={clientsQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(form) => create.mutate(form)}
              />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No maintenance contracts yet"
          description="Add a contract, then link sites to it as they're set up."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Contract</th>
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Sites</th>
                <th className="px-4 py-2 font-medium">SLA (resp / resolve)</th>
                <th className="px-4 py-2 text-right font-medium">Monthly fee</th>
                <th className="px-4 py-2 font-medium">Ends</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canEdit ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.contract_code}
                      {c.frequency ? ` · ${c.frequency}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.clients?.name ?? "—"}</td>
                  <td className="px-4 py-2.5 text-numeric text-muted-foreground">
                    {(c.maintenance_sites ?? []).length}
                  </td>
                  <td className="px-4 py-2.5 text-numeric text-muted-foreground">
                    {c.response_sla_hours ?? "—"}h / {c.resolution_sla_hours ?? "—"}h
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {c.monthly_fee ? inr(Number(c.monthly_fee), true) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {c.end_date ? shortDate(c.end_date) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <Select
                        value={c.status}
                        onValueChange={(status) => setStatus.mutate({ id: c.id, status })}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge value={c.status} />
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditId(c.id)}>
                        Edit terms
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <EditContractDetailsDialog
          contract={editing}
          pending={saveDetails.isPending}
          onOpenChange={(o) => !o && setEditId(null)}
          onSubmit={(details) => saveDetails.mutate({ id: editing.id, details })}
        />
      ) : null}
    </>
  );
}

function NewContractDialog({
  clients,
  pending,
  onSubmit,
}: {
  clients: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (form: {
    title: string;
    clientId: string;
    startDate: string;
    endDate: string;
    monthlyFee: string;
    frequency: string;
    responseSlaHours: string;
    resolutionSlaHours: string;
    gstPercent: string;
    billingTerms: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [frequency, setFrequency] = useState("");
  const [responseSlaHours, setResponseSlaHours] = useState("");
  const [resolutionSlaHours, setResolutionSlaHours] = useState("");
  const [gstPercent, setGstPercent] = useState("18");
  const [billingTerms, setBillingTerms] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add maintenance contract</DialogTitle>
        <DialogDescription>
          Core commercial terms and SLAs now — obligations, access and the rest can be added from
          "Edit terms" once the contract is signed.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="contract-title">Title</Label>
          <Input
            id="contract-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Green Valley Resorts — Annual Landscape AMC"
          />
        </div>
        <div className="grid gap-2">
          <Label>Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contract-start">Start date</Label>
            <Input
              id="contract-start"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contract-end">End date</Label>
            <Input
              id="contract-end"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contract-fee">Monthly fee ₹</Label>
            <Input
              id="contract-fee"
              inputMode="decimal"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contract-freq">Visit frequency</Label>
            <Input
              id="contract-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="e.g. 3x/week"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="contract-response-sla">Response SLA (hrs)</Label>
            <Input
              id="contract-response-sla"
              inputMode="decimal"
              value={responseSlaHours}
              onChange={(e) => setResponseSlaHours(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contract-resolution-sla">Resolution SLA (hrs)</Label>
            <Input
              id="contract-resolution-sla"
              inputMode="decimal"
              value={resolutionSlaHours}
              onChange={(e) => setResolutionSlaHours(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="contract-gst">GST %</Label>
            <Input
              id="contract-gst"
              inputMode="decimal"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="contract-billing">Billing terms</Label>
          <Textarea
            id="contract-billing"
            value={billingTerms}
            onChange={(e) => setBillingTerms(e.target.value)}
            rows={2}
            placeholder="Monthly in advance, 15-day payment terms…"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !title.trim() || !clientId}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              clientId,
              startDate,
              endDate,
              monthlyFee,
              frequency,
              responseSlaHours,
              resolutionSlaHours,
              gstPercent,
              billingTerms,
            })
          }
        >
          {pending ? "Adding…" : "Add contract"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditContractDetailsDialog({
  contract,
  pending,
  onOpenChange,
  onSubmit,
}: {
  contract: {
    title: string;
    renewal_notice_days: number | null;
    escalation_clause: string | null;
    gst_percent: number | null;
    billing_terms: string | null;
    seasonal_allowance: string | null;
    plant_replacement_policy: string | null;
    response_sla_hours: number | null;
    resolution_sla_hours: number | null;
    working_hours: string | null;
    material_cap: number | null;
    equipment_responsibility: string | null;
    client_obligations: string | null;
    access_restrictions: string | null;
    approval_contact: string | null;
  };
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (details: ContractDetails) => void;
}) {
  const [form, setForm] = useState<ContractDetails>({
    renewal_notice_days: contract.renewal_notice_days?.toString() ?? "",
    escalation_clause: contract.escalation_clause ?? "",
    gst_percent: contract.gst_percent?.toString() ?? "",
    billing_terms: contract.billing_terms ?? "",
    seasonal_allowance: contract.seasonal_allowance ?? "",
    plant_replacement_policy: contract.plant_replacement_policy ?? "",
    response_sla_hours: contract.response_sla_hours?.toString() ?? "",
    resolution_sla_hours: contract.resolution_sla_hours?.toString() ?? "",
    working_hours: contract.working_hours ?? "",
    material_cap: contract.material_cap?.toString() ?? "",
    equipment_responsibility: contract.equipment_responsibility ?? "",
    client_obligations: contract.client_obligations ?? "",
    access_restrictions: contract.access_restrictions ?? "",
    approval_contact: contract.approval_contact ?? "",
  });

  const set = (key: keyof ContractDetails) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Contract terms — {contract.title}</DialogTitle>
          <DialogDescription>
            SLAs, billing, seasonal and access terms. Nothing here is required to save.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Response SLA (hrs)</Label>
              <Input
                inputMode="decimal"
                value={form.response_sla_hours}
                onChange={(e) => set("response_sla_hours")(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Resolution SLA (hrs)</Label>
              <Input
                inputMode="decimal"
                value={form.resolution_sla_hours}
                onChange={(e) => set("resolution_sla_hours")(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>GST %</Label>
              <Input
                inputMode="decimal"
                value={form.gst_percent}
                onChange={(e) => set("gst_percent")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Renewal notice (days)</Label>
              <Input
                inputMode="numeric"
                value={form.renewal_notice_days}
                onChange={(e) => set("renewal_notice_days")(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Material cap ₹ / month</Label>
              <Input
                inputMode="decimal"
                value={form.material_cap}
                onChange={(e) => set("material_cap")(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label>Working hours</Label>
            <Input
              value={form.working_hours}
              onChange={(e) => set("working_hours")(e.target.value)}
              placeholder="Mon–Sat, 7am–4pm"
            />
          </div>
          <div className="grid gap-2">
            <Label>Billing terms</Label>
            <Textarea
              rows={2}
              value={form.billing_terms}
              onChange={(e) => set("billing_terms")(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Escalation clause</Label>
            <Textarea
              rows={2}
              value={form.escalation_clause}
              onChange={(e) => set("escalation_clause")(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Seasonal allowance</Label>
            <Textarea
              rows={2}
              value={form.seasonal_allowance}
              onChange={(e) => set("seasonal_allowance")(e.target.value)}
              placeholder="Extra visits during monsoon, reduced mowing in winter…"
            />
          </div>
          <div className="grid gap-2">
            <Label>Plant replacement policy</Label>
            <Textarea
              rows={2}
              value={form.plant_replacement_policy}
              onChange={(e) => set("plant_replacement_policy")(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Equipment responsibility</Label>
            <Textarea
              rows={2}
              value={form.equipment_responsibility}
              onChange={(e) => set("equipment_responsibility")(e.target.value)}
              placeholder="Samak supplies all equipment / client provides water and power…"
            />
          </div>
          <div className="grid gap-2">
            <Label>Client obligations</Label>
            <Textarea
              rows={2}
              value={form.client_obligations}
              onChange={(e) => set("client_obligations")(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Access restrictions</Label>
            <Textarea
              rows={2}
              value={form.access_restrictions}
              onChange={(e) => set("access_restrictions")(e.target.value)}
              placeholder="Security clearance needed, no access before 8am…"
            />
          </div>
          <div className="grid gap-2">
            <Label>Client approval contact</Label>
            <Input
              value={form.approval_contact}
              onChange={(e) => set("approval_contact")(e.target.value)}
              placeholder="Name, phone or email for sign-off on extra work"
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={pending} onClick={() => onSubmit(form)}>
            {pending ? "Saving…" : "Save terms"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

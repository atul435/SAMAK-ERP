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
import { inr, shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/contracts")({
  head: () => ({
    meta: [
      { title: "Maintenance Contracts — EnvironIQ" },
      {
        name: "description",
        content: "AMC and managed-landscape contracts: scope, fee, SLA and renewal dates.",
      },
      { property: "og:title", content: "Maintenance Contracts — EnvironIQ" },
      { property: "og:description", content: "Every signed maintenance contract, scope and fee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceContractsPage,
});

const STATUSES = ["draft", "active", "expired", "terminated"];

function MaintenanceContractsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_contracts")
        .select(
          "id, contract_code, title, status, start_date, end_date, monthly_fee, frequency, clients(name), maintenance_sites(id)",
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
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contract added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-contracts"] });
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
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["maintenance-contracts"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Maintenance Contracts"
        description="AMC and managed-landscape agreements — scope, fee, SLA and renewal terms."
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
                <th className="px-4 py-2 text-right font-medium">Monthly fee</th>
                <th className="px-4 py-2 font-medium">Ends</th>
                <th className="px-4 py-2 font-medium">Status</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [monthlyFee, setMonthlyFee] = useState("");
  const [frequency, setFrequency] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add maintenance contract</DialogTitle>
        <DialogDescription>
          Core commercial terms now — scope lines, SLAs and the rest of the field set can be added
          once the contract is signed.
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
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !title.trim() || !clientId}
          onClick={() =>
            onSubmit({ title: title.trim(), clientId, startDate, endDate, monthlyFee, frequency })
          }
        >
          {pending ? "Adding…" : "Add contract"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

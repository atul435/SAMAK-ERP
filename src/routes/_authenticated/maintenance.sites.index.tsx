import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/sites/")({
  head: () => ({
    meta: [
      { title: "Maintenance Sites — EnvironIQ" },
      {
        name: "description",
        content:
          "Every landscape maintenance site, Samak-built or external, with its zones and assets.",
      },
      { property: "og:title", content: "Maintenance Sites — EnvironIQ" },
      { property: "og:description", content: "Client > site > zone > asset registry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceSitesPage,
});

function MaintenanceSitesPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-sites"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_sites")
        .select(
          "id, site_code, name, city, is_external_build, status, clients(name), maintenance_contracts(title), maintenance_zones(id), maintenance_tasks(id, status)",
        )
        .eq("is_archived", false)
        .order("name");
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

  const contractsQuery = useQuery({
    queryKey: ["maintenance-contracts-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_contracts")
        .select("id, title, client_id")
        .eq("is_archived", false)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      name: string;
      clientId: string;
      contractId: string;
      city: string;
      isExternal: boolean;
    }) => {
      if (!form.clientId) throw new Error("Pick a client.");
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("maintenance_sites")
        .select("id", { count: "exact", head: true });
      const code = `SITE-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("maintenance_sites").insert({
        company_id: employee.company_id,
        client_id: form.clientId,
        contract_id: form.contractId || null,
        site_code: code,
        name: form.name.trim(),
        city: form.city.trim() || null,
        is_external_build: form.isExternal,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-sites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((s) =>
    `${s.name} ${s.site_code} ${s.city ?? ""} ${s.clients?.name ?? ""}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Maintenance Sites"
        description="Client > site > zone > asset — every site under an AMC, whether Samak built it or not."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add site</Button>
              </DialogTrigger>
              <NewSiteDialog
                clients={clientsQuery.data ?? []}
                contracts={contractsQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(form) => create.mutate(form)}
              />
            </Dialog>
          ) : null
        }
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search sites…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No maintenance sites yet"
          description="Add a site to start building its zones, assets, schedules and inspections."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {rows.map((s) => {
            const openTasks = (s.maintenance_tasks ?? []).filter((t) =>
              ["planned", "in_progress"].includes(t.status),
            ).length;
            return (
              <Link
                key={s.id}
                to="/maintenance/sites/$siteId"
                params={{ siteId: s.id }}
                className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-base font-semibold">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.site_code} · {s.clients?.name ?? "—"}
                    </p>
                  </div>
                  <StatusBadge value={s.status} />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Zones</dt>
                    <dd className="font-medium">{(s.maintenance_zones ?? []).length}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Open tasks</dt>
                    <dd className="font-medium">{openTasks}</dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs text-muted-foreground">
                  {s.is_external_build ? "Externally built" : "Samak built"}
                  {s.maintenance_contracts
                    ? ` · ${s.maintenance_contracts.title}`
                    : " · No contract linked"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}

function NewSiteDialog({
  clients,
  contracts,
  pending,
  onSubmit,
}: {
  clients: { id: string; name: string }[];
  contracts: { id: string; title: string; client_id: string }[];
  pending: boolean;
  onSubmit: (form: {
    name: string;
    clientId: string;
    contractId: string;
    city: string;
    isExternal: boolean;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [contractId, setContractId] = useState("");
  const [city, setCity] = useState("");
  const [isExternal, setIsExternal] = useState(false);

  const relevantContracts = contracts.filter((c) => !clientId || c.client_id === clientId);

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add maintenance site</DialogTitle>
        <DialogDescription>
          A site belongs to a client and, once signed, a contract — link the contract later if it
          isn't signed yet.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="site-name">Site name</Label>
          <Input
            id="site-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Green Valley Resorts — Clubhouse Gardens"
          />
        </div>
        <div className="grid gap-2">
          <Label>Client</Label>
          <Select
            value={clientId}
            onValueChange={(v) => {
              setClientId(v);
              setContractId("");
            }}
          >
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
        <div className="grid gap-2">
          <Label>Contract (optional)</Label>
          <Select value={contractId} onValueChange={setContractId}>
            <SelectTrigger>
              <SelectValue placeholder="Not yet signed" />
            </SelectTrigger>
            <SelectContent>
              {relevantContracts.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="site-city">City</Label>
          <Input id="site-city" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={isExternal}
            onChange={(e) => setIsExternal(e.target.checked)}
          />
          <span>
            Samak did not construct this site
            <span className="block text-xs text-muted-foreground">
              A survey/baseline still starts the maintenance record either way.
            </span>
          </span>
        </label>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim() || !clientId}
          onClick={() => onSubmit({ name: name.trim(), clientId, contractId, city, isExternal })}
        >
          {pending ? "Adding…" : "Add site"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

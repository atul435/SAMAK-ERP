import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
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
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/crm/clients")({
  head: () => ({
    meta: [
      { title: "Clients — EnvironIQ CRM" },
      {
        name: "description",
        content:
          "Central client master shared by projects, quotations, billing and Samak Care contracts.",
      },
      { property: "og:title", content: "Clients — EnvironIQ CRM" },
      {
        property: "og:description",
        content: "Central client master shared across every EnvironIQ module.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ClientsPage,
});

function ClientsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("crm", "edit");
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, client_code, name, sector, city, state, gstin, owner_employee_id, projects(id)",
        )
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      name: string;
      sector: string;
      city: string;
      state: string;
      gstin: string;
    }) => {
      if (!form.name.trim()) throw new Error("Client name is required.");
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase.from("clients").select("id", { count: "exact", head: true });
      const code = `CLI-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("clients").insert({
        company_id: employee.company_id,
        client_code: code,
        name: form.name.trim(),
        sector: form.sector.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        gstin: form.gstin.trim() || null,
        owner_employee_id: employee.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Client added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["clients-lite"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((c) =>
    `${c.name} ${c.client_code} ${c.city ?? ""}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Clients"
        description="One client master — never duplicated across modules."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add client</Button>
              </DialogTrigger>
              <NewClientDialog
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
        placeholder="Search clients…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No clients found" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Client</th>
                <th className="px-4 py-2 font-medium">Sector</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Location</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">GSTIN</th>
                <th className="px-4 py-2 text-right font-medium">Projects</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.client_code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {titleCase(c.sector ?? "—")}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {c.city}, {c.state}
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {c.gstin ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">{c.projects?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewClientDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (form: {
    name: string;
    sector: string;
    city: string;
    state: string;
    gstin: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [sector, setSector] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [gstin, setGstin] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add client</DialogTitle>
        <DialogDescription>
          One client record, shared by CRM, design, BOQ, billing and Samak Care — never duplicated
          across modules.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="client-name">Client name</Label>
          <Input
            id="client-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Green Valley Resorts Pvt. Ltd."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="client-sector">Sector</Label>
            <Input
              id="client-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="Hospitality, residential…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-gstin">GSTIN (optional)</Label>
            <Input id="client-gstin" value={gstin} onChange={(e) => setGstin(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="client-city">City</Label>
            <Input id="client-city" value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="client-state">State</Label>
            <Input id="client-state" value={state} onChange={(e) => setState(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim()}
          onClick={() => onSubmit({ name: name.trim(), sector, city, state, gstin })}
        >
          {pending ? "Adding…" : "Add client"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
import { computeTotals } from "@/lib/boq";

export const Route = createFileRoute("/_authenticated/boq/")({
  head: () => ({
    meta: [
      { title: "BOQ & Estimation — EnvironIQ" },
      {
        name: "description",
        content:
          "Bills of quantities and direct client quotations, priced against a design, plant database and project or standalone, with live cost breakdowns and markups.",
      },
      { property: "og:title", content: "BOQ & Estimation — EnvironIQ" },
      {
        property: "og:description",
        content:
          "Every estimate linked to its design and project where one exists, or standalone as a direct quotation for any client.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoqRegister,
});

type NewBoqForm = {
  title: string;
  designId: string;
  clientId: string;
  projectId: string;
  notes: string;
  seedFromPlants: boolean;
};

function BoqRegister() {
  const { can, employee } = useAuth();
  const canEdit = can("boq", "edit");
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [state, setState] = useState("all");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["boqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boqs")
        .select(
          "id, boq_code, title, version, status, approval_state, updated_at, overhead_percent, profit_percent, contingency_percent, tax_percent, projects(name, project_code), designs(design_code, title), clients(name), boq_items(quantity, wastage_percent, unit_rate, item_kind, gst_percent)",
        )
        .eq("is_archived", false)
        .order("boq_code");
      if (error) throw error;
      return data;
    },
  });

  const designsQuery = useQuery({
    queryKey: ["designs-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("id, design_code, title, project_id, client_id, projects(name, project_code)")
        .eq("is_archived", false)
        .order("design_code");
      if (error) throw error;
      return data;
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_code")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: NewBoqForm) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const design = form.designId
        ? (designsQuery.data ?? []).find((d) => d.id === form.designId)
        : undefined;
      if (!design && !form.clientId) {
        throw new Error("Pick a design, or a client for a direct quotation.");
      }
      const next = (query.data ?? []).length + 1;
      const { data: boq, error } = await supabase
        .from("boqs")
        .insert({
          company_id: employee.company_id,
          boq_code: `BOQ-${String(next).padStart(4, "0")}`,
          title: form.title,
          design_id: design?.id ?? null,
          project_id: design?.project_id ?? (form.projectId || null),
          client_id: design?.client_id ?? (form.clientId || null),
          notes: form.notes || null,
          prepared_by: employee.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (design && form.seedFromPlants) {
        const { data: plants, error: plantsError } = await supabase
          .from("design_plant_items")
          .select(
            "quantity, unit_rate, plant_size, zone, plant_species(common_name, botanical_name, id, gst_percent)",
          )
          .eq("design_id", design.id);
        if (plantsError) throw plantsError;
        if (plants && plants.length > 0) {
          const { data: section, error: sectionError } = await supabase
            .from("boq_sections")
            .insert({ boq_id: boq.id, name: "Softscape — Planting", sort_order: 1 })
            .select("id")
            .single();
          if (sectionError) throw sectionError;
          const { error: itemsError } = await supabase.from("boq_items").insert(
            plants.map((p, index) => ({
              boq_id: boq.id,
              section_id: section.id,
              item_kind: "plant",
              description: `${p.plant_species?.common_name ?? "Plant"}${
                p.plant_species?.botanical_name ? ` (${p.plant_species.botanical_name})` : ""
              }${p.plant_size ? ` — ${p.plant_size}` : ""}`,
              species_id: p.plant_species?.id ?? null,
              uom: "nos",
              quantity: Number(p.quantity ?? 0),
              wastage_percent: 5,
              unit_rate: Number(p.unit_rate ?? 0),
              gst_percent: p.plant_species?.gst_percent ?? null,
              remarks: p.zone ? `Zone ${p.zone}` : null,
              sort_order: index + 1,
            })),
          );
          if (itemsError) throw itemsError;
        }
      }
      return boq;
    },
    onSuccess: () => {
      toast.success("BOQ created");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["boqs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (query.data ?? [])
      .map((b) => ({ ...b, totals: computeTotals(b.boq_items ?? [], b) }))
      .filter((b) => {
        const matchesState = state === "all" || b.approval_state === state;
        const haystack =
          `${b.boq_code} ${b.title} ${b.projects?.name ?? ""} ${b.designs?.design_code ?? ""} ${b.clients?.name ?? ""}`.toLowerCase();
        return matchesState && haystack.includes(t);
      });
  }, [query.data, term, state]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const all = query.data ?? [];
  const pipelineValue = all.reduce((sum, b) => sum + computeTotals(b.boq_items ?? [], b).grand, 0);
  const approvedValue = all
    .filter((b) => b.approval_state === "approved")
    .reduce((sum, b) => sum + computeTotals(b.boq_items ?? [], b).grand, 0);

  return (
    <>
      <PageHeader
        title="BOQ & Estimation"
        description="Price a design's plant schedule and cost plan, or start a direct quotation for any client with no design required."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New BOQ</Button>
              </DialogTrigger>
              <NewBoqDialog
                designs={designsQuery.data ?? []}
                clients={clientsQuery.data ?? []}
                projects={projectsQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(form) => create.mutate(form)}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Bills of quantities" value={String(all.length)} />
        <StatCard label="Total estimated value" value={inr(pipelineValue, true)} />
        <StatCard
          label="Awaiting approval"
          value={String(all.filter((b) => b.approval_state === "pending_approval").length)}
          tone="warning"
        />
        <StatCard label="Approved value" value={inr(approvedValue, true)} tone="success" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search BOQ, project, design or client…"
          className="max-w-sm"
        />
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Approval state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending_approval">Pending approval</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No bills of quantities yet"
          description="Create one against a design, or start a direct quotation for a client with no design."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((b) => (
            <Link
              key={b.id}
              to="/boq/$boqId"
              params={{ boqId: b.id }}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{b.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {b.boq_code} · v{b.version} · {(b.boq_items ?? []).length} line items
                  </p>
                </div>
                <StatusBadge value={b.approval_state} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Project</dt>
                  <dd className="font-medium">{b.projects?.name ?? "Unlinked"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Design</dt>
                  <dd className="font-medium">{b.designs?.design_code ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Direct cost</dt>
                  <dd className="font-medium text-numeric">{inr(b.totals.direct)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Quoted total</dt>
                  <dd className="font-medium text-numeric">{inr(b.totals.grand)}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Updated {shortDate(b.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function NewBoqDialog({
  designs,
  clients,
  projects,
  pending,
  onSubmit,
}: {
  designs: {
    id: string;
    design_code: string;
    title: string;
    project_id: string | null;
    client_id: string | null;
    projects: { name: string; project_code: string } | null;
  }[];
  clients: { id: string; name: string }[];
  projects: { id: string; name: string; project_code: string }[];
  pending: boolean;
  onSubmit: (form: NewBoqForm) => void;
}) {
  const [title, setTitle] = useState("");
  const [designId, setDesignId] = useState("");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [seedFromPlants, setSeedFromPlants] = useState(true);

  const design = designs.find((d) => d.id === designId);

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New bill of quantities</DialogTitle>
        <DialogDescription>
          Price a design's plant schedule, or start a direct quotation for a client with no design —
          either way it prices against the plant and material database.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="boq-title">Title</Label>
          <Input
            id="boq-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Landscape package — Phase 1"
          />
        </div>
        <div className="grid gap-2">
          <Label>Design (optional)</Label>
          <Select
            value={designId}
            onValueChange={(v) => {
              setDesignId(v);
              const d = designs.find((x) => x.id === v);
              if (d) {
                setClientId(d.client_id ?? "");
                setProjectId(d.project_id ?? "");
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="No design — direct quotation" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">No design — direct quotation</SelectItem>
              {designs.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.design_code} · {d.title}
                  {d.projects ? ` · ${d.projects.project_code}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {!design ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Client</Label>
              <Select value={clientId} onValueChange={setClientId} disabled={clients.length === 0}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={clients.length === 0 ? "No clients yet" : "Select client"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {clients.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add a client under CRM → Clients first, then come back here.
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label>Project (optional)</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to a project" />
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
          </div>
        ) : (
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-primary"
              checked={seedFromPlants}
              onChange={(e) => setSeedFromPlants(e.target.checked)}
            />
            <span>
              Copy the design plant schedule into this BOQ
              <span className="block text-xs text-muted-foreground">
                Each species becomes a priced line with 5% wastage, using the design rate.
              </span>
            </span>
          </label>
        )}
        <div className="grid gap-2">
          <Label htmlFor="boq-notes">Basis of estimate</Label>
          <Textarea
            id="boq-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Rate sources, exclusions and assumptions behind these numbers."
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !title.trim() || (!design && !clientId)}
          onClick={() =>
            onSubmit({
              title: title.trim(),
              designId: design ? designId : "",
              clientId,
              projectId,
              notes,
              seedFromPlants,
            })
          }
        >
          {pending ? "Creating…" : "Create BOQ"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

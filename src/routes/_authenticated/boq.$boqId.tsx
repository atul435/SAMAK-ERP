import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingState } from "@/components/common/EmptyState";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inr, shortDate, titleCase } from "@/lib/format";
import {
  ITEM_KINDS,
  computeTotals,
  effectiveQuantity,
  executionMap,
  kindBreakdown,
  lineAmount,
  type ExecutionRow,
} from "@/lib/boq";

export const Route = createFileRoute("/_authenticated/boq/$boqId")({
  head: () => ({
    meta: [
      { title: "Bill of Quantities — EnvironIQ" },
      {
        name: "description",
        content:
          "Priced line items, section subtotals, markups and cost breakdown for a landscape bill of quantities.",
      },
      { property: "og:title", content: "Bill of Quantities — EnvironIQ" },
      {
        property: "og:description",
        content: "Rates, quantities and cost breakdown linked to the design and project.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BoqDetail,
});

function BoqDetail() {
  const { boqId } = Route.useParams();
  const { can } = useAuth();
  const canEdit = can("boq", "edit");
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["boq", boqId],
    queryFn: async () => {
      const [boq, sections, items, species, materials, execution] = await Promise.all([
        supabase
          .from("boqs")
          .select(
            "id, boq_code, title, version, notes, status, approval_state, overhead_percent, profit_percent, contingency_percent, tax_percent, updated_at, project_id, design_id, projects(id, name, project_code, contract_value, budget_cost), designs(id, design_code, title, stage), clients(name), employees:prepared_by(full_name)",
          )
          .eq("id", boqId)
          .single(),
        supabase
          .from("boq_sections")
          .select("id, name, sort_order")
          .eq("boq_id", boqId)
          .order("sort_order"),
        supabase
          .from("boq_items")
          .select(
            "id, section_id, item_kind, description, uom, quantity, wastage_percent, unit_rate, gst_percent, remarks, sort_order",
          )
          .eq("boq_id", boqId)
          .order("sort_order"),
        supabase
          .from("plant_species")
          .select(
            "id, common_name, botanical_name, plant_code, pot_bag_size, standard_height_girth, indicative_buy_price, indicative_sell_price, gst_percent, hsn_code",
          )
          .order("common_name"),
        supabase
          .from("materials")
          .select("id, name, uom, standard_rate, gst_percent, hsn_code")
          .order("name"),
        supabase
          .from("boq_item_execution")
          .select("boq_item_id, quantity_done, executed_amount, percent_done, last_reported_on")
          .eq("boq_id", boqId),
      ]);
      if (boq.error) throw boq.error;
      if (sections.error) throw sections.error;
      if (items.error) throw items.error;
      return {
        boq: boq.data,
        sections: sections.data ?? [],
        items: items.data ?? [],
        species: species.data ?? [],
        materials: materials.data ?? [],
        execution: (execution.data ?? []) as ExecutionRow[],
      };
    },
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["boq", boqId] });
    void queryClient.invalidateQueries({ queryKey: ["boqs"] });
  };

  const addSection = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("boq_sections").insert({
        boq_id: boqId,
        name,
        sort_order: (query.data?.sections.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Section added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async (form: {
      sectionId: string;
      itemKind: string;
      description: string;
      uom: string;
      quantity: string;
      wastage: string;
      rate: string;
      gstPercent: string;
      materialId: string;
      speciesId: string;
    }) => {
      const { error } = await supabase.from("boq_items").insert({
        boq_id: boqId,
        section_id: form.sectionId || null,
        item_kind: form.itemKind,
        description: form.description,
        uom: form.uom || "nos",
        quantity: Number(form.quantity || 0),
        wastage_percent: Number(form.wastage || 0),
        unit_rate: Number(form.rate || 0),
        gst_percent: form.gstPercent.trim() ? Number(form.gstPercent) : null,
        material_id: form.materialId || null,
        species_id: form.speciesId || null,
        sort_order: (query.data?.items.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line item added");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("boq_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Line item removed");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMarkups = useMutation({
    mutationFn: async (patch: {
      overhead_percent?: number;
      profit_percent?: number;
      contingency_percent?: number;
      tax_percent?: number;
      notes?: string;
    }) => {
      const { error } = await supabase.from("boqs").update(patch).eq("id", boqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Estimate settings saved");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitForApproval = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("boqs")
        .update({ approval_state: "pending_approval", status: "pending_approval" })
        .eq("id", boqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("BOQ sent for approval");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const data = query.data;
    if (!data) return [];
    const unsectioned = data.items.filter((i) => !i.section_id);
    const sections = data.sections.map((s) => ({
      id: s.id,
      name: s.name,
      items: data.items.filter((i) => i.section_id === s.id),
    }));
    if (unsectioned.length > 0) {
      sections.push({ id: "none", name: "Unassigned items", items: unsectioned });
    }
    return sections;
  }, [query.data]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!query.data) return <ErrorState message="This BOQ could not be found." />;

  const { boq, items, sections, species, materials, execution } = query.data;
  const totals = computeTotals(items, boq);
  const breakdown = kindBreakdown(items);
  const budget = Number(boq.projects?.budget_cost ?? 0);
  const executed = executionMap(execution);
  const executedDirect = items.reduce(
    (sum, item) =>
      sum + Math.min(Number(executed.get(item.id)?.executed_amount ?? 0), lineAmount(item)),
    0,
  );
  const executedPercent = totals.direct > 0 ? (executedDirect / totals.direct) * 100 : 0;

  return (
    <>
      <PageHeader
        title={boq.title}
        description={`${boq.boq_code} · v${boq.version} · prepared by ${boq.employees?.full_name ?? "—"} · updated ${shortDate(boq.updated_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={boq.approval_state} />
            {canEdit && boq.approval_state === "draft" ? (
              <Button
                variant="outline"
                disabled={submitForApproval.isPending || items.length === 0}
                onClick={() => submitForApproval.mutate()}
              >
                Send for approval
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 text-xs">
        {boq.designs ? (
          <Link
            to="/design/$designId"
            params={{ designId: boq.designs.id }}
            className="rounded-full border border-border px-3 py-1 font-medium hover:border-primary/40"
          >
            Design {boq.designs.design_code} · {titleCase(boq.designs.stage)}
          </Link>
        ) : null}
        {boq.projects ? (
          <Link
            to="/projects/$projectId"
            params={{ projectId: boq.projects.id }}
            className="rounded-full border border-border px-3 py-1 font-medium hover:border-primary/40"
          >
            Project {boq.projects.project_code} · {boq.projects.name}
          </Link>
        ) : null}
        <span className="rounded-full border border-border px-3 py-1 text-muted-foreground">
          Client: {boq.clients?.name ?? "—"}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Direct cost"
          value={inr(totals.direct)}
          hint={`${items.length} line items`}
        />
        <StatCard
          label="Executed on site"
          value={inr(executedDirect)}
          hint={`${executedPercent.toFixed(1)}% of direct cost measured`}
          tone={executedPercent > 0 ? "success" : "default"}
        />
        <StatCard
          label="Overhead + contingency"
          value={inr(totals.overhead + totals.contingency)}
        />
        <StatCard label="Margin" value={inr(totals.profit)} tone="success" />
        <StatCard
          label="Quoted total (incl. tax)"
          value={inr(totals.grand)}
          {...(budget > 0 ? { hint: `Project budget ${inr(budget, true)}` } : {})}
          tone={budget > 0 && totals.direct > budget ? "danger" : "default"}
        />
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Line items</TabsTrigger>
          <TabsTrigger value="breakdown">Cost breakdown</TabsTrigger>
          <TabsTrigger value="settings">Markups & basis</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="space-y-4">
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <AddSectionDialog
                pending={addSection.isPending}
                onSubmit={(name) => addSection.mutate(name)}
              />
              <AddItemDialog
                sections={sections}
                species={species}
                materials={materials}
                pending={addItem.isPending}
                onSubmit={(form) => addItem.mutate(form)}
              />
            </div>
          ) : null}

          {grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No sections yet. Add a section such as Site Preparation, Softscape or Irrigation, then
              price its line items.
            </p>
          ) : (
            grouped.map((section) => {
              const subtotal = section.items.reduce((s, i) => s + lineAmount(i), 0);
              return (
                <div key={section.id} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                    <p className="font-display text-sm font-semibold">{section.name}</p>
                    <p className="text-sm font-medium text-numeric">{inr(subtotal)}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-4 py-2 text-left font-medium">Description</th>
                          <th className="px-4 py-2 text-left font-medium">Kind</th>
                          <th className="px-4 py-2 text-right font-medium">Qty</th>
                          <th className="px-4 py-2 text-right font-medium">Incl. wastage</th>
                          <th className="px-4 py-2 text-right font-medium">Rate</th>
                          <th className="px-4 py-2 text-right font-medium">GST</th>
                          <th className="px-4 py-2 text-right font-medium">Amount</th>
                          <th className="px-4 py-2 text-right font-medium">Done on site</th>
                          {canEdit ? <th className="px-4 py-2" /> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {section.items.map((item) => {
                          const exec = executed.get(item.id);
                          const done = Number(exec?.quantity_done ?? 0);
                          const donePct = Number(exec?.percent_done ?? 0);
                          return (
                            <tr key={item.id} className="border-b border-border/60 last:border-0">
                              <td className="px-4 py-2">
                                <p className="font-medium">{item.description}</p>
                                {item.remarks ? (
                                  <p className="text-xs text-muted-foreground">{item.remarks}</p>
                                ) : null}
                              </td>
                              <td className="px-4 py-2 text-xs text-muted-foreground">
                                {titleCase(item.item_kind)}
                              </td>
                              <td className="px-4 py-2 text-right text-numeric">
                                {Number(item.quantity ?? 0).toLocaleString("en-IN")} {item.uom}
                              </td>
                              <td className="px-4 py-2 text-right text-numeric text-muted-foreground">
                                {effectiveQuantity(item).toLocaleString("en-IN", {
                                  maximumFractionDigits: 1,
                                })}
                              </td>
                              <td className="px-4 py-2 text-right text-numeric">
                                {inr(item.unit_rate)}
                              </td>
                              <td className="px-4 py-2 text-right text-numeric text-muted-foreground">
                                {item.gst_percent != null ? `${item.gst_percent}%` : "—"}
                              </td>
                              <td className="px-4 py-2 text-right font-medium text-numeric">
                                {inr(lineAmount(item))}
                              </td>
                              <td className="px-4 py-2 text-right text-numeric">
                                {done > 0 ? (
                                  <>
                                    <span className="font-medium">
                                      {done.toLocaleString("en-IN", { maximumFractionDigits: 1 })}{" "}
                                      {item.uom}
                                    </span>
                                    <span className="block text-xs text-muted-foreground">
                                      {donePct.toFixed(0)}% ·{" "}
                                      {inr(Number(exec?.executed_amount ?? 0))}
                                    </span>
                                  </>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Not started</span>
                                )}
                              </td>
                              {canEdit ? (
                                <td className="px-4 py-2 text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => removeItem.mutate(item.id)}
                                  >
                                    Remove
                                  </Button>
                                </td>
                              ) : null}
                            </tr>
                          );
                        })}
                        {section.items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={canEdit ? 9 : 8}
                              className="px-4 py-4 text-sm text-muted-foreground"
                            >
                              No line items in this section yet.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-border p-5">
              <p className="font-display text-sm font-semibold">Cost build-up</p>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Direct cost" value={inr(totals.direct)} />
                <Row
                  label={`Overhead (${Number(boq.overhead_percent ?? 0)}%)`}
                  value={inr(totals.overhead)}
                />
                <Row
                  label={`Contingency (${Number(boq.contingency_percent ?? 0)}%)`}
                  value={inr(totals.contingency)}
                />
                <Row
                  label={`Margin (${Number(boq.profit_percent ?? 0)}%)`}
                  value={inr(totals.profit)}
                />
                <Row label="Sub-total before tax" value={inr(totals.preTax)} strong />
                <Row
                  label={`GST (${totals.preTax > 0 ? ((totals.tax / totals.preTax) * 100).toFixed(1) : "0"}% effective, from each item's own rate)`}
                  value={inr(totals.tax)}
                />
                <Row label="Quoted total" value={inr(totals.grand)} strong />
              </dl>
            </div>
            <div className="rounded-xl border border-border p-5">
              <p className="font-display text-sm font-semibold">Direct cost by category</p>
              <div className="mt-4 space-y-3">
                {breakdown.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Add line items to see the split.</p>
                ) : (
                  breakdown.map((b) => {
                    const share = totals.direct > 0 ? (b.amount / totals.direct) * 100 : 0;
                    return (
                      <div key={b.kind}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{titleCase(b.kind)}</span>
                          <span className="text-numeric">
                            {inr(b.amount)} · {share.toFixed(0)}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-muted">
                          <div
                            className="h-2 rounded-full bg-primary"
                            style={{ width: `${share}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border p-5">
            <p className="font-display text-sm font-semibold">Section subtotals</p>
            <dl className="mt-4 space-y-2 text-sm">
              {grouped.map((s) => (
                <Row
                  key={s.id}
                  label={s.name}
                  value={inr(s.items.reduce((sum, i) => sum + lineAmount(i), 0))}
                />
              ))}
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="settings">
          <MarkupsPanel
            boq={boq}
            canEdit={canEdit}
            pending={saveMarkups.isPending}
            onSave={(patch) => saveMarkups.mutate(patch)}
          />
        </TabsContent>
      </Tabs>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between border-b border-border/60 pb-2 last:border-0 ${
        strong ? "font-semibold" : ""
      }`}
    >
      <dt className={strong ? "" : "text-muted-foreground"}>{label}</dt>
      <dd className="text-numeric">{value}</dd>
    </div>
  );
}

function AddSectionDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Add section</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add section</DialogTitle>
          <DialogDescription>
            Sections group the estimate the way the site is built — earthwork, softscape, hardscape,
            irrigation.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Label htmlFor="section-name">Section name</Label>
          <Input
            id="section-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Hardscape"
          />
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !name.trim()}
            onClick={() => {
              onSubmit(name.trim());
              setName("");
              setOpen(false);
            }}
          >
            Add section
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SpeciesOption = {
  id: string;
  common_name: string;
  botanical_name: string;
  plant_code: string | null;
  pot_bag_size: string | null;
  standard_height_girth: string | null;
  indicative_buy_price: number | null;
  indicative_sell_price: number | null;
  gst_percent: number | null;
  hsn_code: string | null;
};

type MaterialOption = {
  id: string;
  name: string;
  uom: string;
  standard_rate: number;
  gst_percent: number | null;
  hsn_code: string | null;
};

function AddItemDialog({
  sections,
  species,
  materials,
  pending,
  onSubmit,
}: {
  sections: { id: string; name: string }[];
  species: SpeciesOption[];
  materials: MaterialOption[];
  pending: boolean;
  onSubmit: (form: {
    sectionId: string;
    itemKind: string;
    description: string;
    uom: string;
    quantity: string;
    wastage: string;
    rate: string;
    gstPercent: string;
    materialId: string;
    speciesId: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [itemKind, setItemKind] = useState("material");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("nos");
  const [quantity, setQuantity] = useState("");
  const [wastage, setWastage] = useState("0");
  const [rate, setRate] = useState("");
  const [gstPercent, setGstPercent] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [speciesId, setSpeciesId] = useState("");
  const [speciesOpen, setSpeciesOpen] = useState(false);

  const selectedSpecies = species.find((s) => s.id === speciesId);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add line item</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add line item</DialogTitle>
          <DialogDescription>
            Link the line to a plant species or stock material so rates stay traceable.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label>Section</Label>
              <Select value={sectionId} onValueChange={setSectionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Kind</Label>
              <Select
                value={itemKind}
                onValueChange={(v) => {
                  setItemKind(v);
                  setMaterialId("");
                  setSpeciesId("");
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {titleCase(k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {itemKind === "plant" ? (
            <div className="grid gap-2">
              <Label>Plant species</Label>
              <Popover open={speciesOpen} onOpenChange={setSpeciesOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={speciesOpen}
                    className="justify-between font-normal"
                  >
                    {selectedSpecies
                      ? `${selectedSpecies.common_name} (${selectedSpecies.botanical_name})`
                      : "Search 300+ species by name…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[420px] p-0">
                  <Command>
                    <CommandInput placeholder="Search common or botanical name…" />
                    <CommandList>
                      <CommandEmpty>No species found.</CommandEmpty>
                      <CommandGroup>
                        {species.map((s) => (
                          <CommandItem
                            key={s.id}
                            value={`${s.common_name} ${s.botanical_name} ${s.plant_code ?? ""}`}
                            onSelect={() => {
                              setSpeciesId(s.id);
                              setDescription(`${s.common_name} (${s.botanical_name})`);
                              const suggested = s.indicative_sell_price ?? s.indicative_buy_price;
                              if (suggested != null) setRate(String(suggested));
                              setGstPercent(s.gst_percent != null ? String(s.gst_percent) : "");
                              setSpeciesOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                speciesId === s.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                            <div className="min-w-0">
                              <p className="truncate">
                                {s.common_name}{" "}
                                <span className="text-muted-foreground">({s.botanical_name})</span>
                              </p>
                              {s.indicative_sell_price != null || s.pot_bag_size ? (
                                <p className="text-xs text-muted-foreground">
                                  {s.pot_bag_size ? `${s.pot_bag_size} · ` : ""}
                                  {s.indicative_sell_price != null
                                    ? `~₹${s.indicative_sell_price}`
                                    : ""}
                                </p>
                              ) : null}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedSpecies?.indicative_sell_price != null ||
              selectedSpecies?.indicative_buy_price != null ? (
                <p className="text-xs text-muted-foreground">
                  Suggested rate ₹
                  {selectedSpecies.indicative_sell_price ?? selectedSpecies.indicative_buy_price}{" "}
                  from the plant database
                  {selectedSpecies.standard_height_girth
                    ? ` · ${selectedSpecies.standard_height_girth}`
                    : ""}{" "}
                  — edit below if this quote uses a different size or supplier.
                </p>
              ) : null}
            </div>
          ) : null}

          {itemKind === "material" ? (
            <div className="grid gap-2">
              <Label>Stock material (optional)</Label>
              <Select
                value={materialId}
                onValueChange={(v) => {
                  setMaterialId(v);
                  const m = materials.find((x) => x.id === v);
                  if (m) {
                    setDescription(m.name);
                    setUom(m.uom);
                    setRate(String(m.standard_rate ?? ""));
                    setGstPercent(m.gst_percent != null ? String(m.gst_percent) : "");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select material" />
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
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="item-desc">Description</Label>
            <Textarea
              id="item-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Kota stone paving, 25mm, machine cut"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            <div className="grid gap-2">
              <Label htmlFor="item-uom">Unit</Label>
              <Input id="item-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-qty">Quantity</Label>
              <Input
                id="item-qty"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-wastage">Wastage %</Label>
              <Input
                id="item-wastage"
                inputMode="decimal"
                value={wastage}
                onChange={(e) => setWastage(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="item-rate">Rate ₹</Label>
              <Input
                id="item-rate"
                inputMode="decimal"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2 sm:max-w-[calc(25%-0.75rem)]">
            <Label htmlFor="item-gst">GST %</Label>
            <Input
              id="item-gst"
              inputMode="decimal"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
              placeholder="e.g. 18"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !description.trim() || !quantity}
            onClick={() => {
              onSubmit({
                sectionId,
                itemKind,
                description: description.trim(),
                uom,
                quantity,
                wastage,
                rate,
                gstPercent,
                materialId,
                speciesId,
              });
              setDescription("");
              setQuantity("");
              setRate("");
              setGstPercent("");
              setOpen(false);
            }}
          >
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MarkupsPanel({
  boq,
  canEdit,
  pending,
  onSave,
}: {
  boq: {
    overhead_percent: number | null;
    profit_percent: number | null;
    contingency_percent: number | null;
    tax_percent: number | null;
    notes: string | null;
  };
  canEdit: boolean;
  pending: boolean;
  onSave: (patch: {
    overhead_percent?: number;
    profit_percent?: number;
    contingency_percent?: number;
    tax_percent?: number;
    notes?: string;
  }) => void;
}) {
  const [overhead, setOverhead] = useState(String(boq.overhead_percent ?? 0));
  const [profit, setProfit] = useState(String(boq.profit_percent ?? 0));
  const [contingency, setContingency] = useState(String(boq.contingency_percent ?? 0));
  const [tax, setTax] = useState(String(boq.tax_percent ?? 0));
  const [notes, setNotes] = useState(boq.notes ?? "");

  return (
    <div className="max-w-2xl space-y-4 rounded-xl border border-border p-5">
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="grid gap-2">
          <Label htmlFor="mk-overhead">Overhead %</Label>
          <Input
            id="mk-overhead"
            value={overhead}
            disabled={!canEdit}
            onChange={(e) => setOverhead(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mk-contingency">Contingency %</Label>
          <Input
            id="mk-contingency"
            value={contingency}
            disabled={!canEdit}
            onChange={(e) => setContingency(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mk-profit">Margin %</Label>
          <Input
            id="mk-profit"
            value={profit}
            disabled={!canEdit}
            onChange={(e) => setProfit(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mk-tax">Fallback GST %</Label>
          <Input
            id="mk-tax"
            value={tax}
            disabled={!canEdit}
            onChange={(e) => setTax(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Used only for line items with no GST rate of their own — set each item's real rate when
            adding it instead.
          </p>
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="mk-notes">Basis of estimate</Label>
        <Textarea
          id="mk-notes"
          value={notes}
          disabled={!canEdit}
          rows={4}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Rate sources, exclusions and assumptions behind these numbers."
        />
      </div>
      {canEdit ? (
        <Button
          disabled={pending}
          onClick={() =>
            onSave({
              overhead_percent: Number(overhead || 0),
              contingency_percent: Number(contingency || 0),
              profit_percent: Number(profit || 0),
              tax_percent: Number(tax || 0),
              notes,
            })
          }
        >
          {pending ? "Saving…" : "Save estimate settings"}
        </Button>
      ) : null}
    </div>
  );
}

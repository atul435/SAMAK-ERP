import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
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
import { StatusBadge } from "@/components/common/StatusBadge";
import { inr, pct, shortDate, titleCase } from "@/lib/format";
import {
  HEALTH_GRADES,
  batchAvailable,
  batchPlanted,
  batchValue,
  demandCoverage,
  mortalityPercent,
} from "@/lib/plantiq";

export const Route = createFileRoute("/_authenticated/nursery/")({
  head: () => ({
    meta: [
      { title: "Nursery stock — EnvironIQ" },
      {
        name: "description",
        content:
          "Plant batches in holding, mortality, planting issued to site and estimate coverage for every live landscape project.",
      },
      { property: "og:title", content: "Nursery stock — EnvironIQ" },
      {
        property: "og:description",
        content: "Track plant batches from nursery arrival to the day they go in the ground.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NurseryPage,
});

function NurseryPage() {
  const { can, employee } = useAuth();
  const canEdit = can("nursery", "edit") || can("plantiq", "edit");
  const queryClient = useQueryClient();
  const [projectFilter, setProjectFilter] = useState("all");
  const [openBatch, setOpenBatch] = useState(false);
  const [plantBatchId, setPlantBatchId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["nursery"],
    queryFn: async () => {
      const [batches, plantings, projects, species, stores, boqItems] = await Promise.all([
        supabase
          .from("nursery_batches")
          .select(
            "id, batch_code, species_id, store_id, project_id, boq_item_id, plant_size, pot_size, uom, quantity_received, quantity_mortality, unit_cost, received_date, ready_date, health_grade, location, remarks, plant_species(botanical_name, common_name), stores(name, code), projects(project_code, name)",
          )
          .eq("is_archived", false)
          .order("received_date", { ascending: false }),
        supabase
          .from("plantings")
          .select(
            "id, batch_id, project_id, boq_item_id, species_id, quantity, planted_on, zone, remarks, plant_species(botanical_name), projects(project_code)",
          )
          .order("planted_on", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name, project_code")
          .eq("is_archived", false)
          .order("project_code"),
        supabase
          .from("plant_species")
          .select("id, botanical_name, common_name")
          .order("botanical_name"),
        supabase.from("stores").select("id, name, code").eq("is_active", true).order("code"),
        supabase
          .from("boq_items")
          .select("id, description, species_id, uom, quantity, boqs(project_id, boq_code)")
          .eq("item_kind", "plant"),
      ]);
      for (const r of [batches, plantings, projects, species, stores, boqItems]) {
        if (r.error) throw r.error;
      }
      return {
        batches: batches.data ?? [],
        plantings: plantings.data ?? [],
        projects: projects.data ?? [],
        species: species.data ?? [],
        stores: stores.data ?? [],
        boqItems: boqItems.data ?? [],
      };
    },
  });

  const createBatch = useMutation({
    mutationFn: async (v: BatchForm) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("nursery_batches").insert({
        company_id: employee.company_id,
        batch_code: v.batchCode,
        species_id: v.speciesId,
        store_id: v.storeId || null,
        project_id: v.projectId || null,
        boq_item_id: v.boqItemId || null,
        plant_size: v.plantSize || null,
        pot_size: v.potSize || null,
        uom: v.uom || "nos",
        quantity_received: Number(v.quantity || 0),
        unit_cost: Number(v.unitCost || 0),
        received_date: v.receivedDate,
        ready_date: v.readyDate || null,
        health_grade: v.healthGrade,
        location: v.location || null,
        remarks: v.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Batch booked into the nursery");
      setOpenBatch(false);
      void queryClient.invalidateQueries({ queryKey: ["nursery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const recordPlanting = useMutation({
    mutationFn: async (v: {
      batch: NonNullable<typeof query.data>["batches"][number];
      projectId: string;
      quantity: string;
      plantedOn: string;
      zone: string;
      remarks: string;
      mortality: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("plantings").insert({
        company_id: employee.company_id,
        batch_id: v.batch.id,
        project_id: v.projectId,
        boq_item_id: v.batch.boq_item_id,
        species_id: v.batch.species_id,
        quantity: Number(v.quantity || 0),
        planted_on: v.plantedOn,
        zone: v.zone || null,
        remarks: v.remarks || null,
      });
      if (error) throw error;
      const extraDead = Number(v.mortality || 0);
      if (extraDead > 0) {
        const { error: upErr } = await supabase
          .from("nursery_batches")
          .update({
            quantity_mortality: Number(v.batch.quantity_mortality ?? 0) + extraDead,
          })
          .eq("id", v.batch.id);
        if (upErr) throw upErr;
      }
    },
    onSuccess: () => {
      toast.success("Planting recorded against the project");
      setPlantBatchId(null);
      void queryClient.invalidateQueries({ queryKey: ["nursery"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const all = query.data?.batches ?? [];
    return projectFilter === "all" ? all : all.filter((b) => b.project_id === projectFilter);
  }, [query.data, projectFilter]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const plantings = query.data?.plantings ?? [];
  const inHolding = filtered.reduce((s, b) => s + batchAvailable(b, plantings), 0);
  const holdingValue = filtered.reduce((s, b) => s + batchValue(b, plantings), 0);
  const plantedTotal = filtered.reduce((s, b) => s + batchPlanted(b.id, plantings), 0);
  const mortality = mortalityPercent(filtered);
  const activeBatch = filtered.find((b) => b.id === plantBatchId) ?? null;

  const demandProjectId =
    projectFilter === "all" ? (query.data?.projects[0]?.id ?? "") : projectFilter;
  const demandItems = (query.data?.boqItems ?? []).filter(
    (i) => i.boqs?.project_id === demandProjectId,
  );
  const demand = demandCoverage(demandItems, query.data?.batches ?? [], plantings);

  return (
    <>
      <PageHeader
        title="Nursery stock"
        description="Every plant batch from nursery arrival to the day it goes in the ground — held quantity, mortality and how far it covers the priced estimate."
        actions={
          canEdit ? (
            <Dialog open={openBatch} onOpenChange={setOpenBatch}>
              <DialogTrigger asChild>
                <Button>
                  <Sprout className="mr-2 h-4 w-4" />
                  Book in batch
                </Button>
              </DialogTrigger>
              <NewBatchDialog
                species={query.data?.species ?? []}
                stores={query.data?.stores ?? []}
                projects={query.data?.projects ?? []}
                boqItems={query.data?.boqItems ?? []}
                pending={createBatch.isPending}
                onSubmit={(v) => createBatch.mutate(v)}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Plants in holding" value={inHolding.toLocaleString("en-IN")} />
        <StatCard label="Value in holding" value={inr(holdingValue, true)} />
        <StatCard label="Planted to date" value={plantedTotal.toLocaleString("en-IN")} />
        <StatCard
          label="Mortality"
          value={pct(mortality)}
          tone={mortality > 5 ? "warning" : "success"}
          hint="Against quantity received"
        />
      </div>

      <Select value={projectFilter} onValueChange={setProjectFilter}>
        <SelectTrigger className="max-w-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {(query.data?.projects ?? []).map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.project_code} · {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tabs defaultValue="batches">
        <TabsList>
          <TabsTrigger value="batches">Batches</TabsTrigger>
          <TabsTrigger value="plantings">Plantings</TabsTrigger>
          <TabsTrigger value="demand">Estimate coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="batches" className="space-y-3 pt-4">
          {filtered.length === 0 ? (
            <EmptyState
              title="No batches in the nursery"
              description="Book in the first delivery to start tracking plant stock against the estimate."
            />
          ) : (
            filtered.map((b) => {
              const available = batchAvailable(b, plantings);
              const planted = batchPlanted(b.id, plantings);
              const received = Number(b.quantity_received ?? 0);
              return (
                <article key={b.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">
                        {b.batch_code} · <span className="italic">{b.plant_species?.botanical_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {b.plant_species?.common_name} · {b.plant_size ?? "size not set"} ·{" "}
                        {b.stores?.name ?? "No store"} ·{" "}
                        {b.projects?.project_code ?? "Unallocated"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={b.health_grade} />
                      {canEdit && available > 0 ? (
                        <Button size="sm" variant="outline" onClick={() => setPlantBatchId(b.id)}>
                          Record planting
                        </Button>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
                    {[
                      ["Received", `${received.toLocaleString("en-IN")} ${b.uom}`],
                      ["In holding", `${available.toLocaleString("en-IN")} ${b.uom}`],
                      ["Planted", `${planted.toLocaleString("en-IN")} ${b.uom}`],
                      ["Mortality", `${Number(b.quantity_mortality ?? 0)} ${b.uom}`],
                      ["Rate", inr(Number(b.unit_cost ?? 0))],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-numeric font-medium">{v}</dd>
                      </div>
                    ))}
                  </div>
                  <Progress
                    className="mt-3 h-1.5"
                    value={received > 0 ? Math.min((planted / received) * 100, 100) : 0}
                  />
                  <p className="mt-2 text-xs text-muted-foreground">
                    Received {shortDate(b.received_date)}
                    {b.ready_date ? ` · ready ${shortDate(b.ready_date)}` : ""}
                    {b.location ? ` · ${b.location}` : ""}
                    {b.remarks ? ` · ${b.remarks}` : ""}
                  </p>
                </article>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="plantings" className="space-y-3 pt-4">
          {plantings.length === 0 ? (
            <EmptyState title="Nothing planted yet" />
          ) : (
            <ul className="space-y-2">
              {plantings
                .filter((p) => projectFilter === "all" || p.project_id === projectFilter)
                .map((p) => (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
                  >
                    <div>
                      <p className="font-medium italic">{p.plant_species?.botanical_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.projects?.project_code} · {p.zone ?? "Zone not set"} ·{" "}
                        {shortDate(p.planted_on)}
                        {p.remarks ? ` · ${p.remarks}` : ""}
                      </p>
                    </div>
                    <span className="text-numeric font-medium">
                      {Number(p.quantity ?? 0).toLocaleString("en-IN")}
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="demand" className="pt-4">
          {demand.length === 0 ? (
            <EmptyState
              title="No plant lines on this project's estimate"
              description="Add plant items to the BOQ to compare nursery stock against what was priced."
            />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="p-3">Estimate line</th>
                    <th className="p-3 text-right">Required</th>
                    <th className="p-3 text-right">In nursery</th>
                    <th className="p-3 text-right">Planted</th>
                    <th className="p-3 text-right">Shortfall</th>
                    <th className="p-3 text-right">Cover</th>
                  </tr>
                </thead>
                <tbody>
                  {demand.map((d) => (
                    <tr key={d.boqItemId} className="border-t border-border">
                      <td className="p-3">{d.description}</td>
                      <td className="text-numeric p-3 text-right">
                        {d.required.toLocaleString("en-IN")} {d.uom}
                      </td>
                      <td className="text-numeric p-3 text-right">
                        {d.inNursery.toLocaleString("en-IN")}
                      </td>
                      <td className="text-numeric p-3 text-right">
                        {d.planted.toLocaleString("en-IN")}
                      </td>
                      <td
                        className={`text-numeric p-3 text-right ${d.shortfall > 0 ? "text-destructive" : ""}`}
                      >
                        {d.shortfall.toLocaleString("en-IN")}
                      </td>
                      <td className="text-numeric p-3 text-right">{pct(d.coverPercent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(activeBatch)} onOpenChange={(o) => !o && setPlantBatchId(null)}>
        {activeBatch ? (
          <PlantingDialog
            batch={activeBatch}
            available={batchAvailable(activeBatch, plantings)}
            projects={query.data?.projects ?? []}
            pending={recordPlanting.isPending}
            onSubmit={(v) => recordPlanting.mutate({ ...v, batch: activeBatch })}
          />
        ) : null}
      </Dialog>
    </>
  );
}

type BatchForm = {
  batchCode: string;
  speciesId: string;
  storeId: string;
  projectId: string;
  boqItemId: string;
  plantSize: string;
  potSize: string;
  uom: string;
  quantity: string;
  unitCost: string;
  receivedDate: string;
  readyDate: string;
  healthGrade: string;
  location: string;
  remarks: string;
};

function NewBatchDialog({
  species,
  stores,
  projects,
  boqItems,
  pending,
  onSubmit,
}: {
  species: { id: string; botanical_name: string; common_name: string }[];
  stores: { id: string; name: string; code: string }[];
  projects: { id: string; name: string; project_code: string }[];
  boqItems: { id: string; description: string; species_id: string | null }[];
  pending: boolean;
  onSubmit: (v: BatchForm) => void;
}) {
  const [v, setV] = useState<BatchForm>({
    batchCode: `NB-${Math.floor(1000 + Math.random() * 8999)}`,
    speciesId: species[0]?.id ?? "",
    storeId: stores[0]?.id ?? "",
    projectId: "",
    boqItemId: "",
    plantSize: "",
    potSize: "",
    uom: "nos",
    quantity: "",
    unitCost: "",
    receivedDate: new Date().toISOString().slice(0, 10),
    readyDate: "",
    healthGrade: "good",
    location: "",
    remarks: "",
  });
  const set = (k: keyof BatchForm, val: string) => setV((p) => ({ ...p, [k]: val }));
  const matchingLines = boqItems.filter((i) => i.species_id === v.speciesId);

  return (
    <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Book in a nursery batch</DialogTitle>
        <DialogDescription>
          Record what actually arrived, where it is held and which estimate line it serves.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="nb-code">Batch code</Label>
          <Input
            id="nb-code"
            value={v.batchCode}
            onChange={(e) => set("batchCode", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Species</Label>
          <Select
            value={v.speciesId}
            onValueChange={(val) => {
              set("speciesId", val);
              set("boqItemId", "");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {species.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.botanical_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Holding store</Label>
          <Select value={v.storeId} onValueChange={(val) => set("storeId", val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Earmarked project</Label>
          <Select value={v.projectId || "none"} onValueChange={(val) => set("projectId", val === "none" ? "" : val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unallocated</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Estimate line</Label>
          <Select
            value={v.boqItemId || "none"}
            onValueChange={(val) => set("boqItemId", val === "none" ? "" : val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not linked</SelectItem>
              {matchingLines.map((i) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.description}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-size">Plant size</Label>
          <Input
            id="nb-size"
            value={v.plantSize}
            onChange={(e) => set("plantSize", e.target.value)}
            placeholder="450-600 mm"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-pot">Pot / bag</Label>
          <Input id="nb-pot" value={v.potSize} onChange={(e) => set("potSize", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-qty">Quantity received</Label>
          <Input
            id="nb-qty"
            type="number"
            value={v.quantity}
            onChange={(e) => set("quantity", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-uom">Unit</Label>
          <Input id="nb-uom" value={v.uom} onChange={(e) => set("uom", e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-rate">Rate per unit (₹)</Label>
          <Input
            id="nb-rate"
            type="number"
            value={v.unitCost}
            onChange={(e) => set("unitCost", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Health grade</Label>
          <Select value={v.healthGrade} onValueChange={(val) => set("healthGrade", val)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_GRADES.map((g) => (
                <SelectItem key={g} value={g}>
                  {titleCase(g)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-recv">Received on</Label>
          <Input
            id="nb-recv"
            type="date"
            value={v.receivedDate}
            onChange={(e) => set("receivedDate", e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="nb-ready">Ready to plant</Label>
          <Input
            id="nb-ready"
            type="date"
            value={v.readyDate}
            onChange={(e) => set("readyDate", e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="nb-loc">Holding location</Label>
          <Input
            id="nb-loc"
            value={v.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Block B rows 3-4"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="nb-rem">Remarks</Label>
          <Textarea
            id="nb-rem"
            rows={2}
            value={v.remarks}
            onChange={(e) => set("remarks", e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !v.batchCode.trim() || !v.speciesId || !v.quantity}
          onClick={() => onSubmit(v)}
        >
          {pending ? "Saving…" : "Book in batch"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PlantingDialog({
  batch,
  available,
  projects,
  pending,
  onSubmit,
}: {
  batch: {
    id: string;
    batch_code: string;
    project_id: string | null;
    uom: string;
    plant_species?: { botanical_name: string } | null;
  };
  available: number;
  projects: { id: string; name: string; project_code: string }[];
  pending: boolean;
  onSubmit: (v: {
    projectId: string;
    quantity: string;
    plantedOn: string;
    zone: string;
    remarks: string;
    mortality: string;
  }) => void;
}) {
  const [projectId, setProjectId] = useState(batch.project_id ?? projects[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [plantedOn, setPlantedOn] = useState(new Date().toISOString().slice(0, 10));
  const [zone, setZone] = useState("");
  const [remarks, setRemarks] = useState("");
  const [mortality, setMortality] = useState("");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Record planting — {batch.batch_code}</DialogTitle>
        <DialogDescription>
          {batch.plant_species?.botanical_name} · {available.toLocaleString("en-IN")} {batch.uom}{" "}
          still in holding.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue />
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
        <div className="grid gap-2">
          <Label htmlFor="pl-qty">Quantity planted</Label>
          <Input
            id="pl-qty"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pl-date">Planted on</Label>
          <Input
            id="pl-date"
            type="date"
            value={plantedOn}
            onChange={(e) => setPlantedOn(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pl-zone">Zone</Label>
          <Input id="pl-zone" value={zone} onChange={(e) => setZone(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="pl-dead">Losses to write off</Label>
          <Input
            id="pl-dead"
            type="number"
            value={mortality}
            onChange={(e) => setMortality(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="pl-rem">Remarks</Label>
          <Textarea
            id="pl-rem"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={
            pending || !projectId || !quantity || Number(quantity) <= 0 || Number(quantity) > available
          }
          onClick={() => onSubmit({ projectId, quantity, plantedOn, zone, remarks, mortality })}
        >
          {pending ? "Saving…" : "Record planting"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

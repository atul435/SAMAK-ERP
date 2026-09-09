import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
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
import { inr, dateTime, titleCase } from "@/lib/format";
import { MOVEMENT_TYPES, stockBalances } from "@/lib/procurement";

export const Route = createFileRoute("/_authenticated/inventory/")({
  head: () => ({
    meta: [
      { title: "Inventory & stores — EnvironIQ" },
      {
        name: "description",
        content:
          "Live stock on hand across central, site and nursery stores, movement history, and project requirement coverage against ordered and issued quantities.",
      },
      { property: "og:title", content: "Inventory & stores — EnvironIQ" },
      {
        property: "og:description",
        content: "Stock on hand, issues to site and project material coverage in one view.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const { can, employee } = useAuth();
  const canEdit = can("inventory", "edit");
  const queryClient = useQueryClient();
  const [storeFilter, setStoreFilter] = useState("all");
  const [term, setTerm] = useState("");
  const [projectId, setProjectId] = useState("");
  const [moveOpen, setMoveOpen] = useState(false);

  const query = useQuery({
    queryKey: ["stock"],
    queryFn: async () => {
      const [stores, movements, projects, materials] = await Promise.all([
        supabase.from("stores").select("id, code, name, store_type, projects(name)").order("code"),
        supabase
          .from("stock_movements")
          .select(
            "id, movement_type, description, uom, quantity, unit_rate, moved_at, reference, remarks, store_id, project_id, material_id, species_id, stores(name, code), projects(name, project_code)",
          )
          .order("moved_at", { ascending: false }),
        supabase
          .from("projects")
          .select("id, name, project_code")
          .eq("is_archived", false)
          .order("project_code"),
        supabase.from("materials").select("id, code, name, uom, standard_rate").order("name"),
      ]);
      if (stores.error) throw stores.error;
      if (movements.error) throw movements.error;
      if (projects.error) throw projects.error;
      if (materials.error) throw materials.error;
      return {
        stores: stores.data ?? [],
        movements: movements.data ?? [],
        projects: projects.data ?? [],
        materials: materials.data ?? [],
      };
    },
  });

  const coverageQuery = useQuery({
    queryKey: ["stock-coverage", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const [boqs, orders] = await Promise.all([
        supabase
          .from("boqs")
          .select("id, boq_code, boq_items(id, description, uom, quantity, wastage_percent, unit_rate, item_kind, material_id, species_id)")
          .eq("project_id", projectId)
          .eq("is_archived", false),
        supabase
          .from("purchase_orders")
          .select("id, po_code, approval_state, purchase_order_items(boq_item_id, quantity, received_quantity)")
          .eq("project_id", projectId)
          .eq("is_archived", false),
      ]);
      if (boqs.error) throw boqs.error;
      if (orders.error) throw orders.error;
      return { boqs: boqs.data ?? [], orders: orders.data ?? [] };
    },
  });

  const addMovement = useMutation({
    mutationFn: async (v: {
      storeId: string;
      movementType: string;
      materialId: string;
      description: string;
      uom: string;
      quantity: number;
      unitRate: number;
      projectId: string;
      reference: string;
      remarks: string;
    }) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const { error } = await supabase.from("stock_movements").insert({
        company_id: employee.company_id,
        store_id: v.storeId,
        movement_type: v.movementType,
        material_id: v.materialId || null,
        description: v.description,
        uom: v.uom,
        quantity: v.quantity,
        unit_rate: v.unitRate,
        project_id: v.projectId || null,
        reference: v.reference || null,
        remarks: v.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock movement recorded");
      setMoveOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const movements = useMemo(() => {
    const all = query.data?.movements ?? [];
    return storeFilter === "all" ? all : all.filter((m) => m.store_id === storeFilter);
  }, [query.data, storeFilter]);

  const balances = useMemo(
    () =>
      stockBalances(movements, (m) => m.description ?? "Item").filter((b) =>
        b.label.toLowerCase().includes(term.trim().toLowerCase()),
      ),
    [movements, term],
  );

  const coverage = useMemo(() => {
    if (!coverageQuery.data) return [];
    const orderedByBoqItem = new Map<string, { ordered: number; received: number }>();
    for (const o of coverageQuery.data.orders) {
      for (const i of o.purchase_order_items ?? []) {
        if (!i.boq_item_id) continue;
        const current = orderedByBoqItem.get(i.boq_item_id) ?? { ordered: 0, received: 0 };
        current.ordered += Number(i.quantity ?? 0);
        current.received += Number(i.received_quantity ?? 0);
        orderedByBoqItem.set(i.boq_item_id, current);
      }
    }
    const issuedByItem = new Map<string, number>();
    for (const m of query.data?.movements ?? []) {
      if (m.project_id !== projectId || m.movement_type !== "issue") continue;
      const key = m.material_id ?? m.species_id ?? m.description ?? "";
      issuedByItem.set(key, (issuedByItem.get(key) ?? 0) + Number(m.quantity ?? 0));
    }
    return coverageQuery.data.boqs.flatMap((b) =>
      (b.boq_items ?? [])
        .filter((i) => i.item_kind === "material" || i.item_kind === "plant")
        .map((i) => {
          const required =
            Number(i.quantity ?? 0) * (1 + Number(i.wastage_percent ?? 0) / 100);
          const po = orderedByBoqItem.get(i.id) ?? { ordered: 0, received: 0 };
          const issued = issuedByItem.get(i.material_id ?? i.species_id ?? i.description ?? "") ?? 0;
          return {
            id: i.id,
            boqCode: b.boq_code,
            description: i.description,
            uom: i.uom,
            required,
            ordered: po.ordered,
            received: po.received,
            issued,
            shortfall: Math.max(0, required - po.ordered),
          };
        }),
    );
  }, [coverageQuery.data, query.data, projectId]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const stores = query.data?.stores ?? [];
  const stockValue = balances.reduce((sum, b) => sum + b.value, 0);
  const negatives = balances.filter((b) => b.onHand < 0).length;

  return (
    <>
      <PageHeader
        title="Inventory & stores"
        description="Every receipt and issue moves through a store, so on-hand stock, project consumption and order coverage stay in step."
        actions={
          canEdit ? (
            <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
              <DialogTrigger asChild>
                <Button>Record movement</Button>
              </DialogTrigger>
              <MovementDialog
                stores={stores}
                projects={query.data?.projects ?? []}
                materials={query.data?.materials ?? []}
                pending={addMovement.isPending}
                onSubmit={(v) => addMovement.mutate(v)}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Stores" value={String(stores.length)} />
        <StatCard label="Stock lines" value={String(balances.length)} />
        <StatCard label="Value on hand" value={inr(stockValue, true)} tone="success" />
        <StatCard
          label="Negative balances"
          value={String(negatives)}
          tone={negatives > 0 ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="balances">
        <TabsList>
          <TabsTrigger value="balances">Stock on hand</TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="coverage">Project coverage</TabsTrigger>
        </TabsList>

        <TabsContent value="balances" className="space-y-4 pt-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search item…"
              className="max-w-sm"
            />
            <Select value={storeFilter} onValueChange={setStoreFilter}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="Store" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} · {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {balances.length === 0 ? (
            <EmptyState title="No stock recorded" description="Post a receipt to open stock." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Store</th>
                    <th className="px-4 py-2 text-right font-medium">Received</th>
                    <th className="px-4 py-2 text-right font-medium">Issued</th>
                    <th className="px-4 py-2 text-right font-medium">On hand</th>
                    <th className="px-4 py-2 text-right font-medium">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((b) => (
                    <tr
                      key={b.key}
                      className="border-b border-border last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{b.label}</p>
                        <p className="text-xs text-muted-foreground">{b.uom}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {stores.find((s) => s.id === b.storeId)?.name ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">
                        {b.received.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">{b.issued.toFixed(2)}</td>
                      <td
                        className={
                          b.onHand < 0
                            ? "px-4 py-2.5 text-right text-numeric font-semibold text-destructive"
                            : "px-4 py-2.5 text-right text-numeric font-semibold"
                        }
                      >
                        {b.onHand.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">{inr(b.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="pt-4">
          {movements.length === 0 ? (
            <EmptyState title="No movements yet" />
          ) : (
            <ul className="space-y-3">
              {movements.map((m) => (
                <li key={m.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{m.description}</p>
                    <p className="text-numeric text-sm">
                      {Number(m.quantity ?? 0) >= 0 && m.movement_type !== "issue" ? "+" : "−"}
                      {Math.abs(Number(m.quantity ?? 0)).toFixed(2)} {m.uom}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {titleCase(m.movement_type ?? "")} · {m.stores?.name ?? "Store"} ·{" "}
                    {dateTime(m.moved_at)}
                    {m.projects ? ` · ${m.projects.project_code}` : ""}
                    {m.reference ? ` · ${m.reference}` : ""}
                  </p>
                  {m.remarks ? <p className="mt-2 text-sm">{m.remarks}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="coverage" className="space-y-4 pt-4">
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="max-w-sm">
              <SelectValue placeholder="Choose a project" />
            </SelectTrigger>
            <SelectContent>
              {(query.data?.projects ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {!projectId ? (
            <EmptyState
              title="Pick a project"
              description="See what the estimate needs, what has been ordered, received and issued to site."
            />
          ) : coverageQuery.isLoading ? (
            <LoadingState />
          ) : coverage.length === 0 ? (
            <EmptyState title="No priced material or plant lines for this project yet" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Requirement</th>
                    <th className="px-4 py-2 text-right font-medium">Needed</th>
                    <th className="px-4 py-2 text-right font-medium">Ordered</th>
                    <th className="px-4 py-2 text-right font-medium">Received</th>
                    <th className="px-4 py-2 text-right font-medium">Issued to site</th>
                    <th className="px-4 py-2 text-right font-medium">Still to order</th>
                  </tr>
                </thead>
                <tbody>
                  {coverage.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-border last:border-0 hover:bg-secondary/50"
                    >
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{c.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.boqCode} · {c.uom}
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">
                        {c.required.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">{c.ordered.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-numeric">
                        {c.received.toFixed(2)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-numeric">{c.issued.toFixed(2)}</td>
                      <td
                        className={
                          c.shortfall > 0
                            ? "px-4 py-2.5 text-right text-numeric font-semibold text-warning-foreground"
                            : "px-4 py-2.5 text-right text-numeric text-muted-foreground"
                        }
                      >
                        {c.shortfall > 0 ? c.shortfall.toFixed(2) : "Covered"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

function MovementDialog({
  stores,
  projects,
  materials,
  pending,
  onSubmit,
}: {
  stores: { id: string; code: string; name: string }[];
  projects: { id: string; name: string; project_code: string }[];
  materials: { id: string; code: string; name: string; uom: string; standard_rate: number }[];
  pending: boolean;
  onSubmit: (v: {
    storeId: string;
    movementType: string;
    materialId: string;
    description: string;
    uom: string;
    quantity: number;
    unitRate: number;
    projectId: string;
    reference: string;
    remarks: string;
  }) => void;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [movementType, setMovementType] = useState("issue");
  const [materialId, setMaterialId] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("nos");
  const [quantity, setQuantity] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [projectIdLocal, setProjectIdLocal] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");

  function pickMaterial(id: string) {
    setMaterialId(id);
    const m = materials.find((x) => x.id === id);
    if (m) {
      setDescription(m.name);
      setUom(m.uom);
      setUnitRate(String(m.standard_rate ?? 0));
    }
  }

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Record stock movement</DialogTitle>
        <DialogDescription>
          Issues to a project reduce store stock and show up against that project's consumption.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label>Store</Label>
          <Select value={storeId} onValueChange={setStoreId}>
            <SelectTrigger>
              <SelectValue placeholder="Select store" />
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
          <Label>Type</Label>
          <Select value={movementType} onValueChange={setMovementType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOVEMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {titleCase(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label>Material</Label>
          <Select value={materialId} onValueChange={pickMaterial}>
            <SelectTrigger>
              <SelectValue placeholder="Select from materials master" />
            </SelectTrigger>
            <SelectContent>
              {materials.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.code} · {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="mv-desc">Description</Label>
          <Input
            id="mv-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mv-qty">Quantity</Label>
          <Input
            id="mv-qty"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mv-uom">Unit</Label>
          <Input id="mv-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mv-rate">Rate</Label>
          <Input
            id="mv-rate"
            type="number"
            value={unitRate}
            onChange={(e) => setUnitRate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label>Project</Label>
          <Select value={projectIdLocal} onValueChange={setProjectIdLocal}>
            <SelectTrigger>
              <SelectValue placeholder="Optional" />
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
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="mv-ref">Reference</Label>
          <Input
            id="mv-ref"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="ISS-0004"
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="mv-remarks">Remarks</Label>
          <Textarea
            id="mv-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !storeId || !description.trim() || !(Number(quantity) !== 0)}
          onClick={() =>
            onSubmit({
              storeId,
              movementType,
              materialId,
              description: description.trim(),
              uom,
              quantity: Number(quantity),
              unitRate: Number(unitRate || 0),
              projectId: projectIdLocal,
              reference,
              remarks,
            })
          }
        >
          {pending ? "Saving…" : "Record movement"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { titleCase } from "@/lib/format";
import { searchPlantExplorer } from "@/lib/plant-explorer.functions";

export const Route = createFileRoute("/_authenticated/masters/plants")({
  head: () => ({
    meta: [
      { title: "Plant Explorer — EnvironIQ PlantIQ" },
      {
        name: "description",
        content:
          "Search Samak's plant master in plain English or by filter, then push a shortlist straight into a BOQ or design.",
      },
      { property: "og:title", content: "Plant Explorer — EnvironIQ" },
      {
        property: "og:description",
        content: "Natural-language and filtered plant search, backed by the Smart Plant Master.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlantsPage,
});

const TOLERANCE_FIELDS = [
  ["drought_tolerance", "Drought"],
  ["heat_tolerance", "Heat"],
  ["frost_tolerance", "Frost"],
  ["pollution_tolerance", "Pollution"],
  ["salinity_tolerance", "Salinity"],
] as const;

const REGION_FIELDS = [
  ["delhi_ncr_fit", "Delhi NCR"],
  ["arid_nw_fit", "Arid NW"],
  ["himalayan_foothills_fit", "Himalayan foothills"],
  ["temperate_hills_fit", "Temperate hills"],
  ["western_coast_fit", "Western coast"],
  ["deccan_plateau_fit", "Deccan plateau"],
  ["east_ne_humid_fit", "East & NE humid"],
  ["coastal_south_fit", "Coastal south"],
] as const;

function PlantsPage() {
  const { can } = useAuth();
  const canPushToBoq = can("boq", "edit");
  const canEditPrice = can("plantiq", "edit");
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [waterNeed, setWaterNeed] = useState("all");
  const [sunlight, setSunlight] = useState("all");
  const [maintenance, setMaintenance] = useState("all");

  const [nlQuery, setNlQuery] = useState("");
  const [matches, setMatches] = useState<Map<string, string> | null>(null);
  const [matchSummary, setMatchSummary] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [boqDialogOpen, setBoqDialogOpen] = useState(false);
  const [targetBoqId, setTargetBoqId] = useState("");
  const [pricingSpeciesId, setPricingSpeciesId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["plant_species"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_species")
        .select(
          "id, plant_code, botanical_name, common_name, local_name, family, category, subcategory, native_status, sunlight, water_need, maintenance_level, mature_height_m, mature_spread_m, native_region, notes, ai_design_tags, samak_preferred, samak_field_rating, drought_tolerance, heat_tolerance, frost_tolerance, pollution_tolerance, salinity_tolerance, delhi_ncr_fit, arid_nw_fit, himalayan_foothills_fit, temperate_hills_fit, western_coast_fit, deccan_plateau_fit, east_ne_humid_fit, coastal_south_fit, indicative_buy_price, indicative_sell_price, gst_percent, hsn_code",
        )
        .order("botanical_name");
      if (error) throw error;
      return data;
    },
  });

  const savePricing = useMutation({
    mutationFn: async (form: {
      id: string;
      buyPrice: string;
      sellPrice: string;
      gstPercent: string;
      hsnCode: string;
    }) => {
      const { error } = await supabase
        .from("plant_species")
        .update({
          indicative_buy_price: form.buyPrice.trim() ? Number(form.buyPrice) : null,
          indicative_sell_price: form.sellPrice.trim() ? Number(form.sellPrice) : null,
          gst_percent: form.gstPercent.trim() ? Number(form.gstPercent) : null,
          hsn_code: form.hsnCode.trim() || null,
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pricing saved");
      setPricingSpeciesId(null);
      void queryClient.invalidateQueries({ queryKey: ["plant_species"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const explorerSearch = useServerFn(searchPlantExplorer);
  const ask = useMutation({
    mutationFn: (q: string) => explorerSearch({ data: { query: q } }),
    onSuccess: (result) => {
      const map = new Map(result.matches.map((m) => [m.id, m.reason]));
      setMatches(map);
      setMatchSummary(result.summary);
      setSelected(new Set(map.keys()));
      if (map.size === 0) toast.info("No confident matches — try rephrasing the brief.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const boqsQuery = useQuery({
    queryKey: ["boqs-lite"],
    enabled: boqDialogOpen,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("boqs")
        .select("id, boq_code, title, approval_state")
        .eq("is_archived", false)
        .eq("approval_state", "draft")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const pushToBoq = useMutation({
    mutationFn: async (boqId: string) => {
      const chosen = (query.data ?? []).filter((p) => selected.has(p.id));
      if (chosen.length === 0) throw new Error("Select at least one plant first.");
      const { count } = await supabase
        .from("boq_items")
        .select("id", { count: "exact", head: true })
        .eq("boq_id", boqId);
      const { error } = await supabase.from("boq_items").insert(
        chosen.map((p, index) => ({
          boq_id: boqId,
          item_kind: "plant",
          description: `${p.common_name} (${p.botanical_name})`,
          species_id: p.id,
          uom: "nos",
          quantity: 1,
          wastage_percent: 5,
          unit_rate: Number(p.indicative_sell_price ?? p.indicative_buy_price ?? 0),
          gst_percent: p.gst_percent != null ? Number(p.gst_percent) : null,
          sort_order: (count ?? 0) + index + 1,
        })),
      );
      if (error) throw error;
      return chosen.length;
    },
    onSuccess: (n) => {
      toast.success(`${n} plant${n === 1 ? "" : "s"} added to the BOQ`);
      setBoqDialogOpen(false);
      setTargetBoqId("");
      void queryClient.invalidateQueries({ queryKey: ["boq"] });
      void queryClient.invalidateQueries({ queryKey: ["boqs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const all = query.data ?? [];
  const categories = Array.from(new Set(all.map((p) => p.category).filter(Boolean))).sort();

  const t = term.trim().toLowerCase();
  const filtered = all.filter((p) => {
    if (matches && !matches.has(p.id)) return false;
    if (category !== "all" && p.category !== category) return false;
    if (waterNeed !== "all" && p.water_need !== waterNeed) return false;
    if (sunlight !== "all" && p.sunlight !== sunlight) return false;
    if (maintenance !== "all" && p.maintenance_level !== maintenance) return false;
    if (!t) return true;
    return `${p.botanical_name} ${p.common_name ?? ""} ${p.local_name ?? ""} ${p.family ?? ""} ${p.category ?? ""} ${p.subcategory ?? ""} ${(p.ai_design_tags ?? []).join(" ")}`
      .toLowerCase()
      .includes(t);
  });

  const rows = matches
    ? [...filtered].sort((a, b) => (matches.has(b.id) ? 1 : 0) - (matches.has(a.id) ? 1 : 0))
    : filtered;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSearch = () => {
    setMatches(null);
    setMatchSummary("");
    setSelected(new Set());
  };

  return (
    <>
      <PageHeader
        title="Plant Explorer"
        description={`Search in plain English or by filter, then push a shortlist into a BOQ. ${all.length} species on file.`}
      />

      <div className="rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium">Ask for what you need</p>
        <p className="mt-1 text-xs text-muted-foreground">
          e.g. "20 shade-loving low-maintenance plants for a dry courtyard" — GrowIQ ranks the
          catalogue against your brief.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Textarea
            value={nlQuery}
            onChange={(e) => setNlQuery(e.target.value)}
            rows={2}
            placeholder="Describe the site and what the planting needs to do…"
            className="sm:flex-1"
          />
          <div className="flex gap-2 sm:flex-col">
            <Button
              disabled={ask.isPending || nlQuery.trim().length < 3}
              onClick={() => ask.mutate(nlQuery.trim())}
            >
              {ask.isPending ? "Searching…" : "Find plants"}
            </Button>
            {matches ? (
              <Button variant="outline" onClick={clearSearch}>
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        {matches ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {matchSummary || `${matches.size} matches found.`}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search botanical, common, local name, family or design tag…"
          className="max-w-xs"
        />
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c} value={c!}>
                {titleCase(c!)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={waterNeed} onValueChange={setWaterNeed}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Water need" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any water need</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sunlight} onValueChange={setSunlight}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Sunlight" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any sunlight</SelectItem>
            <SelectItem value="full_sun">Full sun</SelectItem>
            <SelectItem value="part_shade">Part shade</SelectItem>
            <SelectItem value="full_shade">Full shade</SelectItem>
          </SelectContent>
        </Select>
        <Select value={maintenance} onValueChange={setMaintenance}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Maintenance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any maintenance</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {canPushToBoq && selected.size > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5">
          <p className="text-sm font-medium">{selected.size} plant(s) selected</p>
          <Button size="sm" onClick={() => setBoqDialogOpen(true)}>
            Add to BOQ
          </Button>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState title="No species match" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const bestRegions = REGION_FIELDS.filter(([key]) => Number(p[key] ?? 0) >= 4).map(
              ([, label]) => label,
            );
            const reason = matches?.get(p.id);
            return (
              <article
                key={p.id}
                className={`rounded-xl border bg-card p-4 ${
                  reason ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    {canPushToBoq ? (
                      <Checkbox
                        checked={selected.has(p.id)}
                        onCheckedChange={() => toggle(p.id)}
                        className="mt-1"
                      />
                    ) : null}
                    <div>
                      <p className="font-display text-base font-semibold italic">
                        {p.botanical_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {p.common_name}
                        {p.local_name ? ` · ${p.local_name}` : ""}
                      </p>
                    </div>
                  </div>
                  {p.samak_preferred ? (
                    <span
                      className={
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase " +
                        (p.samak_preferred.toLowerCase() === "avoid"
                          ? "border-destructive/30 bg-destructive/10 text-destructive"
                          : p.samak_preferred.toLowerCase() === "preferred"
                            ? "border-success/30 bg-success/15 text-success"
                            : "border-border bg-muted text-muted-foreground")
                      }
                    >
                      {p.samak_preferred}
                    </span>
                  ) : null}
                </div>

                {reason ? (
                  <p className="mt-2 rounded-md bg-primary/10 px-2 py-1 text-xs text-primary">
                    {reason}
                  </p>
                ) : null}

                <p className="mt-1 text-xs text-muted-foreground">
                  {[p.family, p.subcategory || p.category, p.native_status]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {[
                    ["Category", titleCase(p.category ?? "—")],
                    ["Sunlight", titleCase(p.sunlight ?? "—")],
                    ["Water need", titleCase(p.water_need ?? "—")],
                    ["Maintenance", titleCase(p.maintenance_level ?? "—")],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="font-medium">{v}</dd>
                    </div>
                  ))}
                </dl>

                {p.mature_height_m || p.mature_spread_m ? (
                  <p className="mt-3 text-sm">
                    {p.mature_height_m ? (
                      <>
                        Height:{" "}
                        <span className="text-numeric font-medium">
                          {Number(p.mature_height_m)} m
                        </span>
                      </>
                    ) : null}
                    {p.mature_spread_m ? (
                      <>
                        {p.mature_height_m ? " · " : ""}Spread:{" "}
                        <span className="text-numeric font-medium">
                          {Number(p.mature_spread_m)} m
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : null}

                {TOLERANCE_FIELDS.some(([key]) => p[key] != null) ? (
                  <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                    {TOLERANCE_FIELDS.filter(([key]) => p[key] != null).map(([key, label]) => (
                      <span key={key}>
                        {label}{" "}
                        <span className="text-numeric font-medium text-foreground">{p[key]}/5</span>
                      </span>
                    ))}
                  </div>
                ) : null}

                {bestRegions.length > 0 ? (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Strong fit: <span className="text-foreground">{bestRegions.join(", ")}</span>
                  </p>
                ) : null}

                {p.ai_design_tags && p.ai_design_tags.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {p.ai_design_tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : null}

                {p.notes ? <p className="mt-3 text-xs text-muted-foreground">{p.notes}</p> : null}

                <div className="mt-3 flex items-end justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground">
                    {p.plant_code ?? "—"}
                    {p.samak_field_rating ? ` · Field rating ${p.samak_field_rating}/5` : ""}
                    <br />
                    {p.indicative_sell_price != null ? (
                      <span className="text-numeric">₹{p.indicative_sell_price}</span>
                    ) : (
                      "No price set"
                    )}
                    {p.gst_percent != null ? ` · GST ${p.gst_percent}%` : ""}
                    {p.hsn_code ? ` · HSN ${p.hsn_code}` : ""}
                  </p>
                  {canEditPrice ? (
                    <Button variant="ghost" size="sm" onClick={() => setPricingSpeciesId(p.id)}>
                      Edit price
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}

      <Dialog open={boqDialogOpen} onOpenChange={setBoqDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add {selected.size} plant(s) to a BOQ</DialogTitle>
            <DialogDescription>
              Only draft BOQs are listed. Prices come from the plant master and land as unassigned
              line items — adjust quantity and section once there.
            </DialogDescription>
          </DialogHeader>
          {boqsQuery.isLoading ? (
            <LoadingState />
          ) : (boqsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No draft BOQs yet. Create one first from BOQ & Estimation — including a direct client
              quotation with no design.
            </p>
          ) : (
            <Select value={targetBoqId} onValueChange={setTargetBoqId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a BOQ" />
              </SelectTrigger>
              <SelectContent>
                {(boqsQuery.data ?? []).map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.boq_code} · {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button
              disabled={!targetBoqId || pushToBoq.isPending}
              onClick={() => pushToBoq.mutate(targetBoqId)}
            >
              {pushToBoq.isPending ? "Adding…" : "Add to BOQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {pricingSpeciesId ? (
        <PricingDialog
          species={all.find((p) => p.id === pricingSpeciesId)!}
          pending={savePricing.isPending}
          onOpenChange={(open) => !open && setPricingSpeciesId(null)}
          onSubmit={(form) => savePricing.mutate(form)}
        />
      ) : null}
    </>
  );
}

function PricingDialog({
  species,
  pending,
  onOpenChange,
  onSubmit,
}: {
  species: {
    id: string;
    common_name: string;
    botanical_name: string;
    indicative_buy_price: number | null;
    indicative_sell_price: number | null;
    gst_percent: number | null;
    hsn_code: string | null;
  };
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: {
    id: string;
    buyPrice: string;
    sellPrice: string;
    gstPercent: string;
    hsnCode: string;
  }) => void;
}) {
  const [buyPrice, setBuyPrice] = useState(String(species.indicative_buy_price ?? ""));
  const [sellPrice, setSellPrice] = useState(String(species.indicative_sell_price ?? ""));
  const [gstPercent, setGstPercent] = useState(String(species.gst_percent ?? ""));
  const [hsnCode, setHsnCode] = useState(species.hsn_code ?? "");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit pricing</DialogTitle>
          <DialogDescription>
            {species.common_name} ({species.botanical_name})
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="buy-price">Buy price ₹</Label>
              <Input
                id="buy-price"
                inputMode="decimal"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sell-price">Sell price ₹</Label>
              <Input
                id="sell-price"
                inputMode="decimal"
                value={sellPrice}
                onChange={(e) => setSellPrice(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="gst-percent">GST %</Label>
              <Input
                id="gst-percent"
                inputMode="decimal"
                value={gstPercent}
                onChange={(e) => setGstPercent(e.target.value)}
                placeholder="e.g. 5"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="hsn-code">HSN code</Label>
              <Input
                id="hsn-code"
                value={hsnCode}
                onChange={(e) => setHsnCode(e.target.value)}
                placeholder="0602"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() => onSubmit({ id: species.id, buyPrice, sellPrice, gstPercent, hsnCode })}
          >
            {pending ? "Saving…" : "Save pricing"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { inr, dateTime, shortDate, titleCase } from "@/lib/format";

const STAGES = ["concept", "schematic", "detailed", "tender", "as_built"] as const;

export const Route = createFileRoute("/_authenticated/design/$designId")({
  head: () => ({
    meta: [
      { title: "Design sheet — EnvironIQ Design Studio" },
      {
        name: "description",
        content:
          "Site plan, elevation, plant schedule and revision history for a Samak landscape design, linked to its project.",
      },
      { property: "og:title", content: "Design sheet — EnvironIQ" },
      {
        property: "og:description",
        content: "Site plan, elevation, plant schedule and revision history for one design.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DesignDetail,
});

function DesignDetail() {
  const { designId } = Route.useParams();
  const { can, employee } = useAuth();
  const canEdit = can("design", "edit");
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["design", designId] });

  const query = useQuery({
    queryKey: ["design", designId],
    queryFn: async () => {
      const [design, plants, revisions] = await Promise.all([
        supabase
          .from("designs")
          .select(
            "*, projects(id, name, project_code, city), clients(name), employees:designer_id(full_name, designation)",
          )
          .eq("id", designId)
          .maybeSingle(),
        supabase
          .from("design_plant_items")
          .select(
            "id, quantity, plant_size, spacing_mm, zone, unit_rate, remarks, plant_species(id, botanical_name, common_name, category, water_need, sunlight, maintenance_level, mature_height_m)",
          )
          .eq("design_id", designId),
        supabase
          .from("design_revisions")
          .select("id, revision_number, change_summary, issued_at, employees:issued_by(full_name)")
          .eq("design_id", designId)
          .order("revision_number", { ascending: false }),
      ]);
      if (design.error) throw design.error;
      return {
        design: design.data,
        plants: plants.data ?? [],
        revisions: revisions.data ?? [],
      };
    },
  });

  const speciesQuery = useQuery({
    queryKey: ["plant_species_lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_species")
        .select("id, botanical_name, common_name, category")
        .order("botanical_name");
      if (error) throw error;
      return data;
    },
  });

  const saveNotes = useMutation({
    mutationFn: async (patch: {
      stage?: string;
      site_plan_notes?: string | null;
      site_plan_url?: string | null;
      elevation_notes?: string | null;
      elevation_url?: string | null;
    }) => {
      const { error } = await supabase.from("designs").update(patch).eq("id", designId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Design updated");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPlant = useMutation({
    mutationFn: async (row: {
      speciesId: string;
      quantity: number;
      plantSize: string;
      spacing: string;
      zone: string;
      rate: number;
      remarks: string;
    }) => {
      const { error } = await supabase.from("design_plant_items").insert({
        design_id: designId,
        species_id: row.speciesId,
        quantity: row.quantity,
        plant_size: row.plantSize || null,
        spacing_mm: row.spacing ? Number(row.spacing) : null,
        zone: row.zone || null,
        unit_rate: row.rate,
        remarks: row.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plant added to schedule");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePlant = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("design_plant_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const issueRevision = useMutation({
    mutationFn: async (summary: string) => {
      const next = (query.data?.design?.current_revision ?? 0) + 1;
      const { error } = await supabase.from("design_revisions").insert({
        design_id: designId,
        revision_number: next,
        change_summary: summary,
        issued_by: employee?.id ?? null,
      });
      if (error) throw error;
      const { error: upErr } = await supabase
        .from("designs")
        .update({ current_revision: next })
        .eq("id", designId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      toast.success("Revision issued");
      void invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!query.data?.design)
    return <ErrorState message="This design does not exist or you do not have access to it." />;

  const d = query.data.design;
  const plants = query.data.plants;
  const totalPlants = plants.reduce((sum, p) => sum + Number(p.quantity ?? 0), 0);
  const plantCost = plants.reduce(
    (sum, p) => sum + Number(p.quantity ?? 0) * Number(p.unit_rate ?? 0),
    0,
  );

  return (
    <>
      <PageHeader
        title={d.title}
        description={`${d.design_code} · Rev ${d.current_revision} · ${
          d.projects?.project_code ?? "Unlinked"
        } ${d.projects?.name ?? ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={d.stage} />
            <StatusBadge value={d.approval_state} />
            {d.projects?.id ? (
              <Button asChild variant="outline" size="sm">
                <Link to="/projects/$projectId" params={{ projectId: d.projects.id }}>
                  Open project
                </Link>
              </Button>
            ) : null}
            {canEdit ? (
              <IssueRevisionDialog
                pending={issueRevision.isPending}
                onSubmit={(s) => issueRevision.mutate(s)}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Species specified" value={String(plants.length)} />
        <StatCard label="Total plants" value={totalPlants.toLocaleString("en-IN")} />
        <StatCard label="Plant supply value" value={inr(plantCost, true)} />
        <StatCard label="Revisions issued" value={String(query.data.revisions.length)} />
      </div>

      <Tabs defaultValue="site-plan">
        <TabsList className="flex-wrap">
          <TabsTrigger value="site-plan">Site plan</TabsTrigger>
          <TabsTrigger value="elevation">Elevation</TabsTrigger>
          <TabsTrigger value="plants">Plant list</TabsTrigger>
          <TabsTrigger value="revisions">Revisions</TabsTrigger>
          <TabsTrigger value="overview">Details</TabsTrigger>
        </TabsList>

        <TabsContent value="site-plan" className="mt-4">
          <SheetPanel
            heading="Site plan"
            caption={`Plan-level layout${d.scale ? ` at ${d.scale}` : ""} for ${
              d.projects?.city ?? "site"
            }.`}
            notes={d.site_plan_notes}
            url={d.site_plan_url}
            canEdit={canEdit}
            pending={saveNotes.isPending}
            onSave={(notes, url) =>
              saveNotes.mutate({ site_plan_notes: notes || null, site_plan_url: url || null })
            }
          />
        </TabsContent>

        <TabsContent value="elevation" className="mt-4">
          <SheetPanel
            heading="Elevation"
            caption="Vertical layering, canopy heights and sightlines."
            notes={d.elevation_notes}
            url={d.elevation_url}
            canEdit={canEdit}
            pending={saveNotes.isPending}
            onSave={(notes, url) =>
              saveNotes.mutate({ elevation_notes: notes || null, elevation_url: url || null })
            }
          />
        </TabsContent>

        <TabsContent value="plants" className="mt-4 space-y-4">
          {canEdit ? (
            <AddPlantDialog
              species={speciesQuery.data ?? []}
              pending={addPlant.isPending}
              onSubmit={(row) => addPlant.mutate(row)}
            />
          ) : null}
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Species</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Spacing</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {canEdit ? <TableHead /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {plants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canEdit ? 8 : 7} className="text-muted-foreground">
                      No species scheduled yet. Add plants from the central palette.
                    </TableCell>
                  </TableRow>
                ) : (
                  plants.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="text-sm font-medium italic">
                          {p.plant_species?.botanical_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {p.plant_species?.common_name} · {titleCase(p.plant_species?.category ?? "")}
                        </p>
                      </TableCell>
                      <TableCell className="text-sm">{p.zone ?? "—"}</TableCell>
                      <TableCell className="text-sm">{p.plant_size ?? "—"}</TableCell>
                      <TableCell className="text-numeric text-right text-sm">
                        {p.spacing_mm ? `${p.spacing_mm} mm` : "—"}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-sm">
                        {Number(p.quantity).toLocaleString("en-IN")}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-sm">
                        {inr(Number(p.unit_rate))}
                      </TableCell>
                      <TableCell className="text-numeric text-right text-sm font-medium">
                        {inr(Number(p.quantity) * Number(p.unit_rate))}
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removePlant.mutate(p.id)}
                          >
                            Remove
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {plants.length > 0 ? (
            <p className="text-sm text-muted-foreground">
              {totalPlants.toLocaleString("en-IN")} plants across {plants.length} species ·{" "}
              <span className="text-numeric font-medium text-foreground">{inr(plantCost)}</span>{" "}
              supply value at schedule rates.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="revisions" className="mt-4">
          <ol className="space-y-4 rounded-xl border border-border bg-card p-5">
            {query.data.revisions.length === 0 ? (
              <li className="text-sm text-muted-foreground">No revisions issued.</li>
            ) : (
              query.data.revisions.map((r) => (
                <li key={r.id} className="border-l-2 border-primary/40 pl-3">
                  <p className="text-sm font-medium">Revision {r.revision_number}</p>
                  <p className="text-sm text-muted-foreground">{r.change_summary}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.employees?.full_name ?? "Unknown"} · {dateTime(r.issued_at)}
                  </p>
                </li>
              ))
            )}
          </ol>
        </TabsContent>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <dl className="grid gap-4 rounded-xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Design type", titleCase(d.design_type ?? "—")],
              ["Stage", titleCase(d.stage ?? "—")],
              ["Scale", d.scale ?? "—"],
              ["Client", d.clients?.name ?? "—"],
              ["Designer", d.employees?.full_name ?? "Unassigned"],
              ["Last updated", shortDate(d.updated_at)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs tracking-wide text-muted-foreground uppercase">{k}</dt>
                <dd className="mt-0.5 text-sm font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="font-display text-sm font-semibold">Design brief</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {d.brief ?? "No brief recorded for this design yet."}
            </p>
          </div>
          {canEdit ? (
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-5">
              <div className="grid gap-2">
                <Label>Move to stage</Label>
                <Select
                  value={d.stage ?? "concept"}
                  onValueChange={(v) => saveNotes.mutate({ stage: v })}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {titleCase(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Stage changes are written to the audit trail.
              </p>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </>
  );
}

function SheetPanel({
  heading,
  caption,
  notes,
  url,
  canEdit,
  pending,
  onSave,
}: {
  heading: string;
  caption: string;
  notes: string | null;
  url: string | null;
  canEdit: boolean;
  pending: boolean;
  onSave: (notes: string, url: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");
  const [link, setLink] = useState(url ?? "");

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">{heading}</h2>
          <p className="text-xs text-muted-foreground">{caption}</p>
        </div>
        {canEdit ? (
          <Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Edit"}
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="mt-4 grid gap-3">
          <Textarea rows={8} value={draft} onChange={(e) => setDraft(e.target.value)} />
          <div className="grid gap-2">
            <Label>Drawing link</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div>
            <Button
              disabled={pending}
              onClick={() => {
                onSave(draft, link);
                setEditing(false);
              }}
            >
              {pending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed whitespace-pre-line">
            {notes ?? `No ${heading.toLowerCase()} description recorded yet.`}
          </p>
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-block text-sm text-primary hover:underline"
            >
              Open drawing
            </a>
          ) : null}
        </>
      )}
    </div>
  );
}

function IssueRevisionDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (summary: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Issue revision</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue a new revision</DialogTitle>
          <DialogDescription>
            Record what changed so the site team can see why the drawing moved.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={4}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          placeholder="Swale widened to 2.4 m after the drainage review."
        />
        <DialogFooter>
          <Button
            disabled={pending || !summary.trim()}
            onClick={() => {
              onSubmit(summary.trim());
              setSummary("");
              setOpen(false);
            }}
          >
            {pending ? "Issuing…" : "Issue revision"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPlantDialog({
  species,
  pending,
  onSubmit,
}: {
  species: { id: string; botanical_name: string; common_name: string }[];
  pending: boolean;
  onSubmit: (row: {
    speciesId: string;
    quantity: number;
    plantSize: string;
    spacing: string;
    zone: string;
    rate: number;
    remarks: string;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [speciesId, setSpeciesId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [plantSize, setPlantSize] = useState("");
  const [spacing, setSpacing] = useState("");
  const [zone, setZone] = useState("");
  const [rate, setRate] = useState("0");
  const [remarks, setRemarks] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Add species</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add to plant schedule</DialogTitle>
          <DialogDescription>
            Species come from the central plant palette, so design, estimation and nursery stay in
            step.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label>Species</Label>
            <Select value={speciesId} onValueChange={setSpeciesId}>
              <SelectTrigger>
                <SelectValue placeholder="Select species" />
              </SelectTrigger>
              <SelectContent>
                {species.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.botanical_name} · {s.common_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="zone">Zone on site</Label>
              <Input
                id="zone"
                value={zone}
                onChange={(e) => setZone(e.target.value)}
                placeholder="Tree avenue"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="size">Plant size</Label>
              <Input
                id="size"
                value={plantSize}
                onChange={(e) => setPlantSize(e.target.value)}
                placeholder="3-3.5 m ht"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="qty">Quantity</Label>
              <Input
                id="qty"
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="spacing">Spacing (mm)</Label>
              <Input
                id="spacing"
                type="number"
                min="0"
                value={spacing}
                onChange={(e) => setSpacing(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="rate">Unit rate (₹)</Label>
              <Input
                id="rate"
                type="number"
                min="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="remarks">Remarks</Label>
            <Input
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Staked, with tree guard"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending || !speciesId || Number(quantity) <= 0}
            onClick={() => {
              onSubmit({
                speciesId,
                quantity: Number(quantity),
                plantSize,
                spacing,
                zone,
                rate: Number(rate) || 0,
                remarks,
              });
              setOpen(false);
              setSpeciesId("");
              setQuantity("1");
              setPlantSize("");
              setSpacing("");
              setZone("");
              setRate("0");
              setRemarks("");
            }}
          >
            {pending ? "Adding…" : "Add species"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

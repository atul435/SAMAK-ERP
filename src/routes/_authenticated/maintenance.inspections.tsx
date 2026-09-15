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
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/inspections")({
  head: () => ({
    meta: [
      { title: "Inspections — EnvironIQ" },
      {
        name: "description",
        content: "Scored plant health, turf, irrigation and safety inspections by site and zone.",
      },
      { property: "og:title", content: "Inspections — EnvironIQ" },
      { property: "og:description", content: "Findings feed corrective work through issues." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InspectionsPage,
});

const CATEGORIES = [
  "plant_vitality",
  "canopy",
  "pests",
  "weeds",
  "turf_density",
  "irrigation_uniformity",
  "drainage",
  "aesthetics",
  "safety",
  "cleanliness",
  "other",
];
const SEVERITIES = ["low", "medium", "high", "critical"];

function InspectionsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [findingOpenFor, setFindingOpenFor] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["maintenance-inspections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_inspections")
        .select(
          "id, inspection_date, overall_score, notes, maintenance_sites(name), inspection_findings(id, category, severity, notes)",
        )
        .order("inspection_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const sitesQuery = useQuery({
    queryKey: ["maintenance-sites-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_sites")
        .select("id, name")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      siteId: string;
      inspectionDate: string;
      overallScore: string;
      notes: string;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("maintenance_inspections").insert({
        site_id: form.siteId,
        inspection_date: form.inspectionDate || new Date().toISOString().slice(0, 10),
        inspector_employee_id: employee?.id ?? null,
        overall_score: form.overallScore.trim() ? Number(form.overallScore) : null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Inspection recorded");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-inspections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addFinding = useMutation({
    mutationFn: async (form: {
      inspectionId: string;
      category: string;
      severity: string;
      affectedAreaOrCount: string;
      probableCause: string;
      notes: string;
    }) => {
      const { error } = await supabase.from("inspection_findings").insert({
        inspection_id: form.inspectionId,
        category: form.category,
        severity: form.severity,
        affected_area_or_count: form.affectedAreaOrCount.trim()
          ? Number(form.affectedAreaOrCount)
          : null,
        probable_cause: form.probableCause.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Finding added");
      setFindingOpenFor(null);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-inspections"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Inspections"
        description="Scored inspections by site and zone. A finding is a hypothesis until a specialist verifies it."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New inspection</Button>
              </DialogTrigger>
              <NewInspectionDialog
                sites={sitesQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(f) => create.mutate(f)}
              />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No inspections yet"
          description="Record one to start tracking site condition."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((i) => (
            <div key={i.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-semibold">
                    {i.maintenance_sites?.name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {shortDate(i.inspection_date)}
                    {i.overall_score != null ? ` · Score ${i.overall_score}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  {canEdit ? (
                    <Button variant="outline" size="sm" onClick={() => setFindingOpenFor(i.id)}>
                      Add finding
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpanded(expanded === i.id ? null : i.id)}
                  >
                    {(i.inspection_findings ?? []).length} finding
                    {(i.inspection_findings ?? []).length === 1 ? "" : "s"}
                  </Button>
                </div>
              </div>
              {i.notes ? <p className="mt-2 text-sm">{i.notes}</p> : null}
              {expanded === i.id && (i.inspection_findings ?? []).length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-border pt-3">
                  {(i.inspection_findings ?? []).map((f) => (
                    <li key={f.id} className="text-sm">
                      <span className="font-medium">{titleCase(f.category)}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        ({titleCase(f.severity)})
                      </span>
                      {f.notes ? (
                        <span className="block text-xs text-muted-foreground">{f.notes}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {findingOpenFor ? (
        <AddFindingDialog
          inspectionId={findingOpenFor}
          pending={addFinding.isPending}
          onOpenChange={(o) => !o && setFindingOpenFor(null)}
          onSubmit={(f) => addFinding.mutate(f)}
        />
      ) : null}
    </>
  );
}

function NewInspectionDialog({
  sites,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    inspectionDate: string;
    overallScore: string;
    notes: string;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [inspectionDate, setInspectionDate] = useState(new Date().toISOString().slice(0, 10));
  const [overallScore, setOverallScore] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>New inspection</DialogTitle>
        <DialogDescription>Add findings once the inspection record exists.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Site</Label>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger>
              <SelectValue placeholder="Select site" />
            </SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="insp-date">Date</Label>
            <Input
              id="insp-date"
              type="date"
              value={inspectionDate}
              onChange={(e) => setInspectionDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="insp-score">Overall score</Label>
            <Input
              id="insp-score"
              inputMode="decimal"
              value={overallScore}
              onChange={(e) => setOverallScore(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="insp-notes">Notes</Label>
          <Textarea
            id="insp-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !siteId}
          onClick={() => onSubmit({ siteId, inspectionDate, overallScore, notes })}
        >
          {pending ? "Recording…" : "Record inspection"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddFindingDialog({
  inspectionId,
  pending,
  onOpenChange,
  onSubmit,
}: {
  inspectionId: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: {
    inspectionId: string;
    category: string;
    severity: string;
    affectedAreaOrCount: string;
    probableCause: string;
    notes: string;
  }) => void;
}) {
  const [category, setCategory] = useState("plant_vitality");
  const [severity, setSeverity] = useState("low");
  const [affectedAreaOrCount, setAffectedAreaOrCount] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add finding</DialogTitle>
          <DialogDescription>A hypothesis until a specialist verifies it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {titleCase(c)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {titleCase(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="finding-affected">Affected area / count</Label>
            <Input
              id="finding-affected"
              inputMode="decimal"
              value={affectedAreaOrCount}
              onChange={(e) => setAffectedAreaOrCount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="finding-cause">Probable cause</Label>
            <Input
              id="finding-cause"
              value={probableCause}
              onChange={(e) => setProbableCause(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="finding-notes">Notes</Label>
            <Textarea
              id="finding-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={pending}
            onClick={() =>
              onSubmit({
                inspectionId,
                category,
                severity,
                affectedAreaOrCount,
                probableCause,
                notes,
              })
            }
          >
            {pending ? "Adding…" : "Add finding"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

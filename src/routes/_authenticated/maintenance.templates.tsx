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

export const Route = createFileRoute("/_authenticated/maintenance/templates")({
  head: () => ({
    meta: [
      { title: "Service Templates — EnvironIQ" },
      {
        name: "description",
        content:
          "The work library that schedules and tasks are generated from — mowing, pruning, irrigation checks and more.",
      },
      { property: "og:title", content: "Service Templates — EnvironIQ" },
      {
        property: "og:description",
        content: "Standard maintenance work definitions and their norms.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ServiceTemplatesPage,
});

function ServiceTemplatesPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["service-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_templates")
        .select("id, template_code, name, work_type, uom, frequency, standard_hours, is_active")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      name: string;
      workType: string;
      uom: string;
      frequency: string;
      standardHours: string;
      materialsNotes: string;
    }) => {
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("service_templates")
        .select("id", { count: "exact", head: true });
      const code = `SVC-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("service_templates").insert({
        company_id: employee.company_id,
        template_code: code,
        name: form.name.trim(),
        work_type: form.workType.trim() || null,
        uom: form.uom.trim() || "visit",
        frequency: form.frequency.trim() || null,
        standard_hours: form.standardHours.trim() ? Number(form.standardHours) : null,
        materials_notes: form.materialsNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Service template added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["service-templates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Service Templates"
        description="The work library schedules and tasks are generated from — set the unit, frequency and standard hours once."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add template</Button>
              </DialogTrigger>
              <NewTemplateDialog pending={create.isPending} onSubmit={(f) => create.mutate(f)} />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No service templates yet"
          description="Add mowing, pruning, irrigation check and the other standard work types before creating schedules."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((t) => (
            <div key={t.id} className="rounded-xl border border-border bg-card p-4">
              <p className="font-display text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-muted-foreground">{t.template_code}</p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted-foreground">Unit</dt>
                  <dd className="font-medium">{t.uom}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Frequency</dt>
                  <dd className="font-medium">{t.frequency ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Standard hours</dt>
                  <dd className="font-medium">{t.standard_hours ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Work type</dt>
                  <dd className="font-medium">{t.work_type ?? "—"}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function NewTemplateDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (form: {
    name: string;
    workType: string;
    uom: string;
    frequency: string;
    standardHours: string;
    materialsNotes: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [workType, setWorkType] = useState("");
  const [uom, setUom] = useState("visit");
  const [frequency, setFrequency] = useState("");
  const [standardHours, setStandardHours] = useState("");
  const [materialsNotes, setMaterialsNotes] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add service template</DialogTitle>
        <DialogDescription>
          A reusable work definition — mowing, edging, pruning, irrigation check, fertilisation,
          pest scouting, tree assessment and the like.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="tpl-name">Name</Label>
          <Input
            id="tpl-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Lawn mowing"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tpl-type">Work type</Label>
          <Input
            id="tpl-type"
            value={workType}
            onChange={(e) => setWorkType(e.target.value)}
            placeholder="mowing / pruning / irrigation_check…"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="tpl-uom">Unit</Label>
            <Input id="tpl-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-freq">Frequency</Label>
            <Input
              id="tpl-freq"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              placeholder="weekly"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="tpl-hours">Std hours</Label>
            <Input
              id="tpl-hours"
              inputMode="decimal"
              value={standardHours}
              onChange={(e) => setStandardHours(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="tpl-materials">Materials / safety notes</Label>
          <Textarea
            id="tpl-materials"
            value={materialsNotes}
            onChange={(e) => setMaterialsNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            onSubmit({ name: name.trim(), workType, uom, frequency, standardHours, materialsNotes })
          }
        >
          {pending ? "Adding…" : "Add template"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

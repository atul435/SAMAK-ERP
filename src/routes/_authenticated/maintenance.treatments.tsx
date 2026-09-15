import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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

export const Route = createFileRoute("/_authenticated/maintenance/treatments")({
  head: () => ({
    meta: [
      { title: "Plant Treatments — EnvironIQ" },
      {
        name: "description",
        content: "Chemical and organic treatments applied against findings, assets and pests.",
      },
      { property: "og:title", content: "Plant Treatments — EnvironIQ" },
      { property: "og:description", content: "Product, dose, operator, safety and outcome." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlantTreatmentsPage,
});

const OUTCOMES = ["pending", "effective", "partial", "ineffective", "reapply_needed"];

function PlantTreatmentsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["plant-treatments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plant_treatments")
        .select(
          "id, product, dose, application_area, outcome, requires_approval, approval_request_id, follow_up_date, created_at, maintenance_sites(name), inspection_findings(category), employees:operator_employee_id(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(150);
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
      product: string;
      dose: string;
      applicationArea: string;
      weather: string;
      safetyPrecautions: string;
      followUpDate: string;
      requiresApproval: boolean;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("plant_treatments").insert({
        site_id: form.siteId,
        product: form.product.trim() || null,
        dose: form.dose.trim() || null,
        application_area: form.applicationArea.trim() || null,
        operator_employee_id: employee?.id ?? null,
        weather: form.weather.trim() || null,
        safety_precautions: form.safetyPrecautions.trim() || null,
        follow_up_date: form.followUpDate || null,
        requires_approval: form.requiresApproval,
        outcome: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Treatment logged");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["plant-treatments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setOutcome = useMutation({
    mutationFn: async ({ id, outcome }: { id: string; outcome: string }) => {
      const { error } = await supabase.from("plant_treatments").update({ outcome }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["plant-treatments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const requestApproval = useMutation({
    mutationFn: async (t: { id: string; product: string | null; site: string }) => {
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true });
      const requestCode = `APR-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const label = `${t.product ?? "Treatment"} — ${t.site}`;
      const { data: approval, error } = await supabase
        .from("approval_requests")
        .insert({
          company_id: employee.company_id,
          request_code: requestCode,
          entity_type: "plant_treatment",
          entity_id: t.id,
          entity_label: label,
          summary: `Restricted-use treatment approval: ${label}`,
          state: "pending_approval",
          requested_by: employee.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: treatError } = await supabase
        .from("plant_treatments")
        .update({ approval_request_id: approval.id })
        .eq("id", t.id);
      if (treatError) throw treatError;
    },
    onSuccess: () => {
      toast.success("Sent for approval");
      void queryClient.invalidateQueries({ queryKey: ["plant-treatments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Plant Treatments"
        description="Chemical and organic treatments — restricted-use products need approval before application."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Log treatment</Button>
              </DialogTrigger>
              <NewTreatmentDialog
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
          title="No treatments logged yet"
          description="Log a treatment here, or from a finding on the Inspections page."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Treatment</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Operator</th>
                <th className="px-4 py-2 font-medium">Applied</th>
                <th className="px-4 py-2 font-medium">Outcome</th>
                {canEdit ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr
                  key={t.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{t.product ?? "Treatment"}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.dose ? `${t.dose} · ` : ""}
                      {t.inspection_findings?.category
                        ? titleCase(t.inspection_findings.category)
                        : t.application_area || "—"}
                      {t.requires_approval ? " · Requires approval" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.maintenance_sites?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {t.employees?.full_name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{shortDate(t.created_at)}</td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <Select
                        value={t.outcome ?? "pending"}
                        onValueChange={(outcome) => setOutcome.mutate({ id: t.id, outcome })}
                      >
                        <SelectTrigger className="h-7 w-36 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OUTCOMES.map((o) => (
                            <SelectItem key={o} value={o}>
                              {titleCase(o)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge value={t.outcome} />
                    )}
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {t.requires_approval && !t.approval_request_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={requestApproval.isPending}
                          onClick={() =>
                            requestApproval.mutate({
                              id: t.id,
                              product: t.product,
                              site: t.maintenance_sites?.name ?? "",
                            })
                          }
                        >
                          Send for approval
                        </Button>
                      ) : t.requires_approval ? (
                        <span className="text-xs text-muted-foreground">Approval sent</span>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewTreatmentDialog({
  sites,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    product: string;
    dose: string;
    applicationArea: string;
    weather: string;
    safetyPrecautions: string;
    followUpDate: string;
    requiresApproval: boolean;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [product, setProduct] = useState("");
  const [dose, setDose] = useState("");
  const [applicationArea, setApplicationArea] = useState("");
  const [weather, setWeather] = useState("");
  const [safetyPrecautions, setSafetyPrecautions] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [requiresApproval, setRequiresApproval] = useState(false);

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Log treatment</DialogTitle>
        <DialogDescription>
          A chemical or organic application — fertiliser, pesticide, fungicide, growth regulator.
        </DialogDescription>
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
            <Label htmlFor="treat-product">Product</Label>
            <Input
              id="treat-product"
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              placeholder="Neem oil / NPK 19:19:19…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="treat-dose">Dose</Label>
            <Input id="treat-dose" value={dose} onChange={(e) => setDose(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="treat-area">Application area</Label>
          <Input
            id="treat-area"
            value={applicationArea}
            onChange={(e) => setApplicationArea(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="treat-weather">Weather</Label>
            <Input
              id="treat-weather"
              value={weather}
              onChange={(e) => setWeather(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="treat-followup">Follow-up date</Label>
            <Input
              id="treat-followup"
              type="date"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="treat-safety">Safety precautions</Label>
          <Textarea
            id="treat-safety"
            value={safetyPrecautions}
            onChange={(e) => setSafetyPrecautions(e.target.value)}
            rows={2}
            placeholder="PPE, re-entry interval, buffer zones…"
          />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={requiresApproval}
            onChange={(e) => setRequiresApproval(e.target.checked)}
          />
          <span>
            Restricted-use product
            <span className="block text-xs text-muted-foreground">
              Needs approval before application.
            </span>
          </span>
        </label>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !siteId}
          onClick={() =>
            onSubmit({
              siteId,
              product,
              dose,
              applicationArea,
              weather,
              safetyPrecautions,
              followUpDate,
              requiresApproval,
            })
          }
        >
          {pending ? "Logging…" : "Log treatment"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
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
import { inr, shortDate, dateTime, titleCase } from "@/lib/format";
import {
  LABOUR_TRADES,
  PHOTO_CATEGORIES,
  attendanceTotals,
  captureLocation,
  formatCoords,
  mapsLink,
  workProgress,
  type Coords,
} from "@/lib/site-ops";

export const Route = createFileRoute("/_authenticated/site/$reportId")({
  head: () => ({
    meta: [
      { title: "Daily site report — EnvironIQ" },
      {
        name: "description",
        content:
          "A single day on site: work quantities against plan, labour attendance and cost, materials received into the site store and geo-tagged photos.",
      },
      { property: "og:title", content: "Daily site report — EnvironIQ" },
      {
        property: "og:description",
        content: "Progress, manpower, materials and photos for one day on a landscape site.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SiteReportDetail,
});

function SiteReportDetail() {
  const { reportId } = Route.useParams();
  const { can, employee } = useAuth();
  const canEdit = can("site_ops", "edit");
  const canReceive = can("inventory", "edit") || canEdit;
  const queryClient = useQueryClient();
  const [workOpen, setWorkOpen] = useState(false);
  const [labourOpen, setLabourOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);

  const query = useQuery({
    queryKey: ["site-report", reportId],
    queryFn: async () => {
      const report = await supabase
        .from("site_reports")
        .select(
          "id, report_date, weather, temperature_c, work_done, planned_next, blockers, progress_percent, latitude, longitude, location_accuracy_m, approval_state, project_id, company_id, projects(id, name, project_code, city), employees(full_name, designation)",
        )
        .eq("id", reportId)
        .maybeSingle();
      if (report.error) throw report.error;
      if (!report.data) return { report: null };

      const [items, labour, photos, receipts, stores, materials, boqLines] = await Promise.all([
        supabase
          .from("site_report_items")
          .select(
            "id, description, uom, quantity_planned, quantity_done, remarks, sort_order, boq_item_id",
          )
          .eq("site_report_id", reportId)
          .order("sort_order"),
        supabase
          .from("labour_attendance")
          .select(
            "id, trade, headcount_planned, headcount_present, hours_worked, day_rate, remarks, vendors(name)",
          )
          .eq("site_report_id", reportId)
          .order("trade"),
        supabase
          .from("site_photos")
          .select("id, title, caption, category, storage_path, latitude, longitude, taken_at")
          .eq("site_report_id", reportId)
          .order("taken_at"),
        supabase
          .from("stock_movements")
          .select("id, description, uom, quantity, unit_rate, reference, remarks, moved_at, stores(name)")
          .eq("project_id", report.data.project_id)
          .eq("movement_type", "receipt")
          .gte("moved_at", `${report.data.report_date}T00:00:00Z`)
          .lte("moved_at", `${report.data.report_date}T23:59:59Z`)
          .order("moved_at"),
        supabase.from("stores").select("id, code, name").eq("is_active", true).order("code"),
        supabase.from("materials").select("id, code, name, uom, standard_rate").order("name"),
        supabase
          .from("boq_item_execution")
          .select(
            "boq_item_id, description, uom, quantity_planned, quantity_done, unit_rate, percent_done",
          )
          .eq("project_id", report.data.project_id)
          .eq("boq_approval_state", "approved")
          .order("description"),
      ]);
      if (items.error) throw items.error;
      if (labour.error) throw labour.error;
      if (photos.error) throw photos.error;
      if (receipts.error) throw receipts.error;
      if (stores.error) throw stores.error;
      if (materials.error) throw materials.error;

      const signed = await Promise.all(
        (photos.data ?? []).map(async (p) => {
          if (!p.storage_path) return { ...p, url: null as string | null };
          const { data } = await supabase.storage
            .from("site-photos")
            .createSignedUrl(p.storage_path, 3600);
          return { ...p, url: data?.signedUrl ?? null };
        }),
      );

      return {
        report: report.data,
        items: items.data ?? [],
        labour: labour.data ?? [],
        photos: signed,
        receipts: receipts.data ?? [],
        stores: stores.data ?? [],
        materials: materials.data ?? [],
        boqLines: boqLines.data ?? [],
      };
    },
  });

  const report = query.data?.report;

  const addWorkLine = useMutation({
    mutationFn: async (v: {
      description: string;
      uom: string;
      planned: number;
      done: number;
      remarks: string;
      boqItemId: string | null;
    }) => {
      const { error } = await supabase.from("site_report_items").insert({
        site_report_id: reportId,
        description: v.description,
        uom: v.uom,
        quantity_planned: v.planned,
        quantity_done: v.done,
        remarks: v.remarks || null,
        boq_item_id: v.boqItemId,
        sort_order: (query.data?.items ?? []).length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work line added");
      setWorkOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["site-report", reportId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addLabour = useMutation({
    mutationFn: async (v: {
      trade: string;
      planned: number;
      present: number;
      hours: number;
      rate: number;
      remarks: string;
    }) => {
      if (!report) throw new Error("Report missing.");
      const { error } = await supabase.from("labour_attendance").insert({
        company_id: report.company_id,
        project_id: report.project_id,
        site_report_id: reportId,
        attendance_date: report.report_date,
        trade: v.trade,
        headcount_planned: v.planned,
        headcount_present: v.present,
        hours_worked: v.hours,
        day_rate: v.rate,
        remarks: v.remarks || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance recorded");
      setLabourOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["site-report", reportId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPhoto = useMutation({
    mutationFn: async (v: {
      file: File;
      title: string;
      caption: string;
      category: string;
      coords: Coords | null;
    }) => {
      if (!report) throw new Error("Report missing.");
      const ext = v.file.name.split(".").pop() ?? "jpg";
      const path = `${report.project_id}/${reportId}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("site-photos")
        .upload(path, v.file, { contentType: v.file.type });
      if (upErr) throw upErr;
      const { error } = await supabase.from("site_photos").insert({
        company_id: report.company_id,
        project_id: report.project_id,
        site_report_id: reportId,
        title: v.title,
        caption: v.caption || null,
        category: v.category,
        storage_path: path,
        latitude: v.coords?.latitude ?? report.latitude,
        longitude: v.coords?.longitude ?? report.longitude,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Photo uploaded");
      setPhotoOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["site-report", reportId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addReceipt = useMutation({
    mutationFn: async (v: {
      storeId: string;
      materialId: string;
      description: string;
      uom: string;
      quantity: number;
      unitRate: number;
      reference: string;
      remarks: string;
    }) => {
      if (!report) throw new Error("Report missing.");
      const { error } = await supabase.from("stock_movements").insert({
        company_id: report.company_id,
        store_id: v.storeId,
        movement_type: "receipt",
        material_id: v.materialId || null,
        description: v.description,
        uom: v.uom,
        quantity: v.quantity,
        unit_rate: v.unitRate,
        project_id: report.project_id,
        reference: v.reference || null,
        remarks: v.remarks || null,
        moved_at: `${report.report_date}T09:00:00Z`,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material receipt recorded");
      setReceiptOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["site-report", reportId] });
      void queryClient.invalidateQueries({ queryKey: ["stock"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("site_reports")
        .update({ approval_state: "approved", status: "approved" })
        .eq("id", reportId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Report approved");
      void queryClient.invalidateQueries({ queryKey: ["site-report", reportId] });
      void queryClient.invalidateQueries({ queryKey: ["site-reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!report) return <EmptyState title="Site report not found" />;

  const items = query.data?.items ?? [];
  const labour = query.data?.labour ?? [];
  const photos = query.data?.photos ?? [];
  const receipts = query.data?.receipts ?? [];
  const boqLines = query.data?.boqLines ?? [];
  const boqLineMap = new Map(boqLines.map((l) => [l.boq_item_id as string, l]));
  const dayEstimateValue = items.reduce((sum, i) => {
    const line = i.boq_item_id ? boqLineMap.get(i.boq_item_id) : undefined;
    return sum + Number(i.quantity_done ?? 0) * Number(line?.unit_rate ?? 0);
  }, 0);
  const crew = attendanceTotals(labour);
  const link = mapsLink(report.latitude, report.longitude);

  return (
    <>
      <PageHeader
        title={`${report.projects?.project_code} · ${shortDate(report.report_date)}`}
        description={`${report.projects?.name} · ${titleCase(report.weather ?? "")}${
          report.temperature_c ? ` ${Number(report.temperature_c).toFixed(0)}°C` : ""
        } · logged by ${report.employees?.full_name ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={report.approval_state} />
            {can("site_ops", "approve") && report.approval_state === "submitted" ? (
              <Button onClick={() => approve.mutate()}>Approve report</Button>
            ) : null}
            <Link
              to="/projects/$projectId"
              params={{ projectId: report.project_id }}
              className="text-sm font-medium text-primary hover:underline"
            >
              Open project
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Crew on site"
          value={`${crew.present}/${crew.planned}`}
          hint={`${crew.manDays.toFixed(1)} man-days`}
          tone={crew.fulfilment < 85 && crew.planned > 0 ? "warning" : "default"}
        />
        <StatCard label="Labour cost" value={inr(crew.cost)} />
        <StatCard
          label="Work against plan"
          value={`${workProgress(items).toFixed(0)}%`}
          hint={`${items.length} activities`}
        />
        <StatCard
          label="Value executed today"
          value={inr(dayEstimateValue)}
          hint="At approved estimate rates"
          tone={dayEstimateValue > 0 ? "success" : "default"}
        />
        <StatCard label="Photos" value={String(photos.length)} />
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="font-display text-sm font-semibold">Day summary</h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {link ? (
              <a href={link} target="_blank" rel="noreferrer" className="hover:underline">
                {formatCoords(report.latitude, report.longitude)}
              </a>
            ) : (
              formatCoords(report.latitude, report.longitude)
            )}
            {report.location_accuracy_m
              ? ` · ±${Number(report.location_accuracy_m).toFixed(0)} m`
              : ""}
          </span>
        </div>
        <p className="mt-3 text-sm whitespace-pre-wrap">{report.work_done}</p>
        {report.planned_next ? (
          <p className="mt-3 text-sm">
            <span className="font-medium">Planned next: </span>
            {report.planned_next}
          </p>
        ) : null}
        {report.blockers ? (
          <p className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {report.blockers}
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="progress">
        <TabsList>
          <TabsTrigger value="progress">Progress</TabsTrigger>
          <TabsTrigger value="labour">Labour</TabsTrigger>
          <TabsTrigger value="materials">Materials received</TabsTrigger>
          <TabsTrigger value="photos">Photos</TabsTrigger>
        </TabsList>

        <TabsContent value="progress" className="space-y-4 pt-4">
          {canEdit ? (
            <Dialog open={workOpen} onOpenChange={setWorkOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Add work line</Button>
              </DialogTrigger>
              <WorkLineDialog
                pending={addWorkLine.isPending}
                boqLines={boqLines}
                onSubmit={(v) => addWorkLine.mutate(v)}
              />
            </Dialog>
          ) : null}
          {items.length === 0 ? (
            <EmptyState title="No measured activities recorded for the day" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Activity</th>
                    <th className="px-4 py-2 text-right font-medium">Planned</th>
                    <th className="px-4 py-2 text-right font-medium">Done</th>
                    <th className="px-4 py-2 text-right font-medium">Achieved</th>
                    <th className="px-4 py-2 text-right font-medium">Estimate line to date</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i) => {
                    const planned = Number(i.quantity_planned ?? 0);
                    const done = Number(i.quantity_done ?? 0);
                    const pctDone = planned > 0 ? (done / planned) * 100 : 0;
                    const line = i.boq_item_id ? boqLineMap.get(i.boq_item_id) : undefined;
                    return (
                      <tr
                        key={i.id}
                        className="border-b border-border last:border-0 hover:bg-secondary/50"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{i.description}</p>
                          {line ? (
                            <p className="text-xs text-muted-foreground">
                              Estimate: {line.description} · {inr(Number(line.unit_rate ?? 0))}/
                              {line.uom}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Not linked to an estimate line
                            </p>
                          )}
                          {i.remarks ? (
                            <p className="text-xs text-muted-foreground">{i.remarks}</p>
                          ) : null}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {planned.toFixed(2)} {i.uom}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {done.toFixed(2)} {i.uom}
                        </td>
                        <td
                          className={
                            pctDone < 80
                              ? "px-4 py-2.5 text-right text-numeric font-semibold text-warning-foreground"
                              : "px-4 py-2.5 text-right text-numeric font-semibold text-success"
                          }
                        >
                          {pctDone.toFixed(0)}%
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {line ? (
                            <>
                              <span className="font-medium">
                                {Number(line.quantity_done ?? 0).toLocaleString("en-IN", {
                                  maximumFractionDigits: 1,
                                })}
                                {" / "}
                                {Number(line.quantity_planned ?? 0).toLocaleString("en-IN")}{" "}
                                {line.uom}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {Number(line.percent_done ?? 0).toFixed(0)}% of estimate
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="labour" className="space-y-4 pt-4">
          {canEdit ? (
            <Dialog open={labourOpen} onOpenChange={setLabourOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Record attendance</Button>
              </DialogTrigger>
              <LabourDialog pending={addLabour.isPending} onSubmit={(v) => addLabour.mutate(v)} />
            </Dialog>
          ) : null}
          {labour.length === 0 ? (
            <EmptyState title="No attendance recorded for this day" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Trade</th>
                    <th className="px-4 py-2 text-right font-medium">Planned</th>
                    <th className="px-4 py-2 text-right font-medium">Present</th>
                    <th className="px-4 py-2 text-right font-medium">Hours</th>
                    <th className="px-4 py-2 text-right font-medium">Day rate</th>
                    <th className="px-4 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {labour.map((l) => {
                    const t = attendanceTotals([l]);
                    return (
                      <tr
                        key={l.id}
                        className="border-b border-border last:border-0 hover:bg-secondary/50"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{l.trade}</p>
                          <p className="text-xs text-muted-foreground">
                            {l.vendors?.name ?? "Own crew"}
                            {l.remarks ? ` · ${l.remarks}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {l.headcount_planned}
                        </td>
                        <td
                          className={
                            Number(l.headcount_present ?? 0) < Number(l.headcount_planned ?? 0)
                              ? "px-4 py-2.5 text-right text-numeric font-semibold text-warning-foreground"
                              : "px-4 py-2.5 text-right text-numeric font-semibold"
                          }
                        >
                          {l.headcount_present}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {Number(l.hours_worked ?? 0).toFixed(1)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {inr(Number(l.day_rate ?? 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">{inr(t.cost)}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5 text-right text-numeric">{crew.planned}</td>
                    <td className="px-4 py-2.5 text-right text-numeric">{crew.present}</td>
                    <td className="px-4 py-2.5 text-right text-numeric">
                      {crew.manDays.toFixed(1)} md
                    </td>
                    <td />
                    <td className="px-4 py-2.5 text-right text-numeric">{inr(crew.cost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="materials" className="space-y-4 pt-4">
          {canReceive ? (
            <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Record material receipt</Button>
              </DialogTrigger>
              <ReceiptDialog
                stores={query.data?.stores ?? []}
                materials={query.data?.materials ?? []}
                pending={addReceipt.isPending}
                onSubmit={(v) => addReceipt.mutate(v)}
              />
            </Dialog>
          ) : null}
          {receipts.length === 0 ? (
            <EmptyState
              title="Nothing received on site this day"
              description="Receipts recorded here land in the store and show up in inventory."
            />
          ) : (
            <ul className="space-y-3">
              {receipts.map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-medium">{r.description}</p>
                    <p className="text-numeric text-sm">
                      {Number(r.quantity ?? 0).toFixed(2)} {r.uom} ·{" "}
                      {inr(Number(r.quantity ?? 0) * Number(r.unit_rate ?? 0))}
                    </p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {r.stores?.name ?? "Store"} · {dateTime(r.moved_at)}
                    {r.reference ? ` · ${r.reference}` : ""}
                  </p>
                  {r.remarks ? <p className="mt-2 text-sm">{r.remarks}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="photos" className="space-y-4 pt-4">
          {canEdit ? (
            <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Upload photo</Button>
              </DialogTrigger>
              <PhotoDialog
                fallback={formatCoords(report.latitude, report.longitude)}
                pending={addPhoto.isPending}
                onSubmit={(v) => addPhoto.mutate(v)}
              />
            </Dialog>
          ) : null}
          {photos.length === 0 ? (
            <EmptyState title="No photos for this day" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {photos.map((p) => (
                <figure key={p.id} className="overflow-hidden rounded-xl border border-border bg-card">
                  {p.url ? (
                    <img
                      src={p.url}
                      alt={p.title}
                      loading="lazy"
                      className="h-44 w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-44 w-full items-center justify-center bg-secondary text-xs text-muted-foreground">
                      Photo pending upload from site
                    </div>
                  )}
                  <figcaption className="space-y-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium">{p.title}</p>
                      <StatusBadge value={p.category} />
                    </div>
                    {p.caption ? <p className="text-sm">{p.caption}</p> : null}
                    <p className="text-xs text-muted-foreground">
                      {dateTime(p.taken_at)} · {formatCoords(p.latitude, p.longitude)}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}

type BoqLineOption = {
  boq_item_id: string | null;
  description: string | null;
  uom: string | null;
  quantity_planned: number | null;
  quantity_done: number | null;
  unit_rate: number | null;
  percent_done: number | null;
};

function WorkLineDialog({
  pending,
  boqLines,
  onSubmit,
}: {
  pending: boolean;
  boqLines: BoqLineOption[];
  onSubmit: (v: {
    description: string;
    uom: string;
    planned: number;
    done: number;
    remarks: string;
    boqItemId: string | null;
  }) => void;
}) {
  const [boqItemId, setBoqItemId] = useState("none");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("sqm");
  const [planned, setPlanned] = useState("");
  const [done, setDone] = useState("");
  const [remarks, setRemarks] = useState("");

  const selected = boqLines.find((l) => l.boq_item_id === boqItemId);

  const pickLine = (value: string) => {
    setBoqItemId(value);
    const line = boqLines.find((l) => l.boq_item_id === value);
    if (!line) return;
    setDescription(line.description ?? "");
    setUom(line.uom ?? "sqm");
    const remaining =
      Number(line.quantity_planned ?? 0) - Number(line.quantity_done ?? 0);
    setPlanned(remaining > 0 ? String(Number(remaining.toFixed(2))) : "");
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add work line</DialogTitle>
        <DialogDescription>
          Measure the day's work against an approved estimate line so project and estimate progress
          update automatically.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="wl-boq">Estimate line</Label>
          <Select value={boqItemId} onValueChange={pickLine}>
            <SelectTrigger id="wl-boq">
              <SelectValue placeholder="Link to an approved estimate line" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not linked to the estimate</SelectItem>
              {boqLines.map((l) => (
                <SelectItem key={l.boq_item_id} value={l.boq_item_id ?? ""}>
                  {l.description} · {Number(l.percent_done ?? 0).toFixed(0)}% done
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected ? (
            <p className="text-xs text-muted-foreground">
              {Number(selected.quantity_done ?? 0).toLocaleString("en-IN", {
                maximumFractionDigits: 1,
              })}{" "}
              of {Number(selected.quantity_planned ?? 0).toLocaleString("en-IN")} {selected.uom}{" "}
              measured so far at {inr(Number(selected.unit_rate ?? 0))}/{selected.uom}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Only lines from an approved estimate for this project are listed.
            </p>
          )}
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="wl-desc">Activity</Label>
          <Input id="wl-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wl-uom">Unit</Label>
          <Input id="wl-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wl-planned">Planned</Label>
          <Input
            id="wl-planned"
            type="number"
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="wl-done">Done</Label>
          <Input id="wl-done" type="number" value={done} onChange={(e) => setDone(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="wl-remarks">Remarks</Label>
          <Textarea
            id="wl-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !description.trim()}
          onClick={() =>
            onSubmit({
              description: description.trim(),
              uom,
              planned: Number(planned || 0),
              done: Number(done || 0),
              remarks,
              boqItemId: boqItemId === "none" ? null : boqItemId,
            })
          }
        >
          {pending ? "Saving…" : "Add line"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LabourDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (v: {
    trade: string;
    planned: number;
    present: number;
    hours: number;
    rate: number;
    remarks: string;
  }) => void;
}) {
  const [trade, setTrade] = useState<string>(LABOUR_TRADES[0]);
  const [planned, setPlanned] = useState("");
  const [present, setPresent] = useState("");
  const [hours, setHours] = useState("8");
  const [rate, setRate] = useState("");
  const [remarks, setRemarks] = useState("");
  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Record attendance</DialogTitle>
        <DialogDescription>Headcount by trade for this day on this site.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label>Trade</Label>
          <Select value={trade} onValueChange={setTrade}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LABOUR_TRADES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="la-planned">Planned headcount</Label>
          <Input
            id="la-planned"
            type="number"
            value={planned}
            onChange={(e) => setPlanned(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="la-present">Present</Label>
          <Input
            id="la-present"
            type="number"
            value={present}
            onChange={(e) => setPresent(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="la-hours">Hours worked</Label>
          <Input id="la-hours" type="number" value={hours} onChange={(e) => setHours(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="la-rate">Day rate (₹)</Label>
          <Input id="la-rate" type="number" value={rate} onChange={(e) => setRate(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="la-remarks">Remarks</Label>
          <Textarea
            id="la-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !trade}
          onClick={() =>
            onSubmit({
              trade,
              planned: Number(planned || 0),
              present: Number(present || 0),
              hours: Number(hours || 8),
              rate: Number(rate || 0),
              remarks,
            })
          }
        >
          {pending ? "Saving…" : "Record"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ReceiptDialog({
  stores,
  materials,
  pending,
  onSubmit,
}: {
  stores: { id: string; code: string; name: string }[];
  materials: { id: string; code: string; name: string; uom: string; standard_rate: number }[];
  pending: boolean;
  onSubmit: (v: {
    storeId: string;
    materialId: string;
    description: string;
    uom: string;
    quantity: number;
    unitRate: number;
    reference: string;
    remarks: string;
  }) => void;
}) {
  const [storeId, setStoreId] = useState(stores[0]?.id ?? "");
  const [materialId, setMaterialId] = useState("");
  const [description, setDescription] = useState("");
  const [uom, setUom] = useState("nos");
  const [quantity, setQuantity] = useState("");
  const [unitRate, setUnitRate] = useState("");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");

  function pick(id: string) {
    setMaterialId(id);
    const m = materials.find((x) => x.id === id);
    if (m) {
      setDescription(m.name);
      setUom(m.uom);
      setUnitRate(String(m.standard_rate ?? 0));
    }
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Material received at site</DialogTitle>
        <DialogDescription>
          Goes straight into the store balance and this project's consumption.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
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
        <div className="grid gap-2 sm:col-span-2">
          <Label>Material</Label>
          <Select value={materialId} onValueChange={pick}>
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
          <Label htmlFor="mr-desc">Description</Label>
          <Input id="mr-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-qty">Quantity</Label>
          <Input
            id="mr-qty"
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-uom">Unit</Label>
          <Input id="mr-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-rate">Rate (₹)</Label>
          <Input
            id="mr-rate"
            type="number"
            value={unitRate}
            onChange={(e) => setUnitRate(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="mr-ref">Challan reference</Label>
          <Input id="mr-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="mr-remarks">Condition on arrival</Label>
          <Textarea
            id="mr-remarks"
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !storeId || !description.trim() || !(Number(quantity) > 0)}
          onClick={() =>
            onSubmit({
              storeId,
              materialId,
              description: description.trim(),
              uom,
              quantity: Number(quantity),
              unitRate: Number(unitRate || 0),
              reference,
              remarks,
            })
          }
        >
          {pending ? "Saving…" : "Record receipt"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PhotoDialog({
  fallback,
  pending,
  onSubmit,
}: {
  fallback: string;
  pending: boolean;
  onSubmit: (v: {
    file: File;
    title: string;
    caption: string;
    category: string;
    coords: Coords | null;
  }) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [category, setCategory] = useState<string>("progress");
  const [coords, setCoords] = useState<Coords | null>(null);
  const [locating, setLocating] = useState(false);

  async function grabLocation() {
    setLocating(true);
    try {
      setCoords(await captureLocation());
      toast.success("Location captured");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLocating(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Upload site photo</DialogTitle>
        <DialogDescription>
          Shot from the phone camera works best — the photo is stamped with where it was taken.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="ph-file">Photo</Label>
          <Input
            id="ph-file"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ph-title">Title</Label>
          <Input id="ph-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {titleCase(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="ph-caption">Caption</Label>
          <Textarea
            id="ph-caption"
            rows={2}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
        </div>
        <div>
          <Button type="button" variant="outline" onClick={grabLocation} disabled={locating}>
            <MapPin className="mr-2 h-4 w-4" />
            {locating ? "Locating…" : "Capture location"}
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            {coords
              ? `${formatCoords(coords.latitude, coords.longitude)} · ±${coords.accuracy.toFixed(0)} m`
              : `Falls back to the report location (${fallback}).`}
          </p>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !file || !title.trim()}
          onClick={() =>
            file
              ? onSubmit({ file, title: title.trim(), caption: caption.trim(), category, coords })
              : undefined
          }
        >
          {pending ? "Uploading…" : "Upload photo"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

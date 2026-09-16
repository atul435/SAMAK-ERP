import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/sites/$siteId")({
  head: () => ({
    meta: [
      { title: "Maintenance Site — EnvironIQ" },
      {
        name: "description",
        content: "Zones, assets, schedules, tasks, inspections and issues for a site.",
      },
      { property: "og:title", content: "Maintenance Site — EnvironIQ" },
      {
        property: "og:description",
        content: "A landscape maintenance site's full operating record.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceSiteDetail,
});

const ZONE_TYPES = [
  "lawn",
  "bed",
  "tree_avenue",
  "irrigation_area",
  "indoor_plant_cluster",
  "built_feature",
  "other",
];
const ASSET_TYPES = [
  "tree",
  "shrub_group",
  "turf",
  "seasonal_bed",
  "indoor_plant",
  "planter",
  "irrigation_controller",
  "irrigation_valve",
  "irrigation_zone",
  "pump",
  "drainage",
  "hardscape",
  "water_feature",
  "lighting",
  "soil_sensor",
  "equipment",
];

function MaintenanceSiteDetail() {
  const { siteId } = Route.useParams();
  const { can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [zoneOpen, setZoneOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-site", siteId],
    queryFn: async () => {
      const [site, zones, assets, tasks, issues] = await Promise.all([
        supabase
          .from("maintenance_sites")
          .select(
            "id, site_code, name, address, city, state, is_external_build, status, clients(name), maintenance_contracts(title)",
          )
          .eq("id", siteId)
          .single(),
        supabase
          .from("maintenance_zones")
          .select("id, zone_code, name, zone_type, area_sqm")
          .eq("site_id", siteId)
          .order("name"),
        supabase
          .from("maintenance_assets")
          .select(
            "id, asset_code, asset_type, specification, count_or_area, uom, condition, zone_id, plant_species(common_name)",
          )
          .eq("site_id", siteId)
          .order("asset_type"),
        supabase
          .from("maintenance_tasks")
          .select("id, title, task_type, status, planned_date")
          .eq("site_id", siteId)
          .order("planned_date", { ascending: false })
          .limit(15),
        supabase
          .from("maintenance_issues")
          .select("id, title, severity, status, created_at")
          .eq("site_id", siteId)
          .order("created_at", { ascending: false })
          .limit(15),
      ]);
      if (site.error) throw site.error;
      if (zones.error) throw zones.error;
      if (assets.error) throw assets.error;
      return {
        site: site.data,
        zones: zones.data ?? [],
        assets: assets.data ?? [],
        tasks: tasks.data ?? [],
        issues: issues.data ?? [],
      };
    },
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["maintenance-site", siteId] });

  const addZone = useMutation({
    mutationFn: async (form: { name: string; zoneType: string; areaSqm: string }) => {
      const { error } = await supabase.from("maintenance_zones").insert({
        site_id: siteId,
        name: form.name.trim(),
        zone_type: form.zoneType,
        area_sqm: form.areaSqm.trim() ? Number(form.areaSqm) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zone added");
      setZoneOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addAsset = useMutation({
    mutationFn: async (form: {
      zoneId: string;
      assetType: string;
      specification: string;
      countOrArea: string;
      uom: string;
    }) => {
      const { error } = await supabase.from("maintenance_assets").insert({
        site_id: siteId,
        zone_id: form.zoneId || null,
        asset_type: form.assetType,
        specification: form.specification.trim() || null,
        count_or_area: form.countOrArea.trim() ? Number(form.countOrArea) : null,
        uom: form.uom.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Asset added");
      setAssetOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!query.data) return <ErrorState message="This site could not be found." />;

  const { site, zones, assets, tasks, issues } = query.data;
  const openTasks = tasks.filter((t) => ["planned", "in_progress"].includes(t.status)).length;
  const openIssues = issues.filter((i) => !["closed", "verified"].includes(i.status)).length;

  return (
    <>
      <PageHeader
        title={site.name}
        description={`${site.site_code} · ${site.clients?.name ?? "—"} · ${site.city ?? ""}`}
        actions={<StatusBadge value={site.status} />}
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Zones" value={String(zones.length)} />
        <StatCard label="Assets" value={String(assets.length)} />
        <StatCard label="Open tasks" value={String(openTasks)} />
        <StatCard
          label="Open issues"
          value={String(openIssues)}
          tone={openIssues > 0 ? "warning" : "default"}
        />
      </div>

      <Tabs defaultValue="zones">
        <TabsList>
          <TabsTrigger value="zones">Zones & assets</TabsTrigger>
          <TabsTrigger value="tasks">Recent visits</TabsTrigger>
          <TabsTrigger value="issues">Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="zones" className="space-y-4">
          {canEdit ? (
            <div className="flex flex-wrap gap-2">
              <Dialog open={zoneOpen} onOpenChange={setZoneOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">Add zone</Button>
                </DialogTrigger>
                <AddZoneDialog pending={addZone.isPending} onSubmit={(f) => addZone.mutate(f)} />
              </Dialog>
              <Dialog open={assetOpen} onOpenChange={setAssetOpen}>
                <DialogTrigger asChild>
                  <Button>Add asset</Button>
                </DialogTrigger>
                <AddAssetDialog
                  zones={zones}
                  pending={addAsset.isPending}
                  onSubmit={(f) => addAsset.mutate(f)}
                />
              </Dialog>
            </div>
          ) : null}

          {zones.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              No zones yet. Add a zone (lawn, bed, tree avenue…) before logging assets against it.
            </p>
          ) : (
            zones.map((zone) => {
              const zoneAssets = assets.filter((a) => a.zone_id === zone.id);
              return (
                <div key={zone.id} className="overflow-hidden rounded-xl border border-border">
                  <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-3">
                    <p className="font-display text-sm font-semibold">
                      {zone.name}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({titleCase(zone.zone_type)}
                        {zone.area_sqm ? ` · ${zone.area_sqm} m²` : ""})
                      </span>
                    </p>
                  </div>
                  {zoneAssets.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">No assets logged.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <tbody>
                        {zoneAssets.map((a) => (
                          <tr key={a.id} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-2">
                              <p className="font-medium">
                                {titleCase(a.asset_type)}
                                {a.plant_species?.common_name
                                  ? ` — ${a.plant_species.common_name}`
                                  : ""}
                              </p>
                              {a.specification ? (
                                <p className="text-xs text-muted-foreground">{a.specification}</p>
                              ) : null}
                            </td>
                            <td className="px-4 py-2 text-right text-numeric text-muted-foreground">
                              {a.count_or_area != null ? `${a.count_or_area} ${a.uom ?? ""}` : ""}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <StatusBadge value={a.condition ?? "good"} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })
          )}

          {assets.filter((a) => !a.zone_id).length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border">
              <div className="bg-muted/40 px-4 py-3">
                <p className="font-display text-sm font-semibold">Unassigned to a zone</p>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {assets
                    .filter((a) => !a.zone_id)
                    .map((a) => (
                      <tr key={a.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2">{titleCase(a.asset_type)}</td>
                        <td className="px-4 py-2 text-right text-numeric text-muted-foreground">
                          {a.count_or_area != null ? `${a.count_or_area} ${a.uom ?? ""}` : ""}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </TabsContent>

        <TabsContent value="tasks">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No visits yet — create one from Maintenance → Visits.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Task</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium">Planned</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => (
                    <tr key={t.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2">{t.title}</td>
                      <td className="px-4 py-2 text-muted-foreground">{titleCase(t.task_type)}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {shortDate(t.planned_date)}
                      </td>
                      <td className="px-4 py-2">
                        <StatusBadge value={t.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="issues">
          {issues.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No requests yet — create one from Maintenance → Service Requests.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Issue</th>
                    <th className="px-4 py-2 font-medium">Severity</th>
                    <th className="px-4 py-2 font-medium">Raised</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {issues.map((i) => (
                    <tr key={i.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2">{i.title}</td>
                      <td className="px-4 py-2 text-muted-foreground">{titleCase(i.severity)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{shortDate(i.created_at)}</td>
                      <td className="px-4 py-2">
                        <StatusBadge value={i.status} />
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

function AddZoneDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (form: { name: string; zoneType: string; areaSqm: string }) => void;
}) {
  const [name, setName] = useState("");
  const [zoneType, setZoneType] = useState("lawn");
  const [areaSqm, setAreaSqm] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add zone</DialogTitle>
        <DialogDescription>
          A zone groups assets and work — a lawn, a bed, a tree avenue, an irrigation area.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="zone-name">Zone name</Label>
          <Input
            id="zone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Front lawn"
          />
        </div>
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={zoneType} onValueChange={setZoneType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ZONE_TYPES.map((z) => (
                <SelectItem key={z} value={z}>
                  {titleCase(z)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="zone-area">Area (m², optional)</Label>
          <Input
            id="zone-area"
            inputMode="decimal"
            value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim()}
          onClick={() => onSubmit({ name: name.trim(), zoneType, areaSqm })}
        >
          {pending ? "Adding…" : "Add zone"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddAssetDialog({
  zones,
  pending,
  onSubmit,
}: {
  zones: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (form: {
    zoneId: string;
    assetType: string;
    specification: string;
    countOrArea: string;
    uom: string;
  }) => void;
}) {
  const [zoneId, setZoneId] = useState("");
  const [assetType, setAssetType] = useState("tree");
  const [specification, setSpecification] = useState("");
  const [countOrArea, setCountOrArea] = useState("");
  const [uom, setUom] = useState("nos");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add asset</DialogTitle>
        <DialogDescription>
          A physical thing this site is responsible for maintaining — a tree, a turf area, an
          irrigation controller.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Zone (optional)</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger>
              <SelectValue placeholder="Not assigned to a zone" />
            </SelectTrigger>
            <SelectContent>
              {zones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Asset type</Label>
          <Select value={assetType} onValueChange={setAssetType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASSET_TYPES.map((a) => (
                <SelectItem key={a} value={a}>
                  {titleCase(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="asset-spec">Specification</Label>
          <Textarea
            id="asset-spec"
            value={specification}
            onChange={(e) => setSpecification(e.target.value)}
            rows={2}
            placeholder="Species, size, model — whatever identifies it"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="asset-count">Count / area</Label>
            <Input
              id="asset-count"
              inputMode="decimal"
              value={countOrArea}
              onChange={(e) => setCountOrArea(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="asset-uom">Unit</Label>
            <Input id="asset-uom" value={uom} onChange={(e) => setUom(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !assetType}
          onClick={() => onSubmit({ zoneId, assetType, specification, countOrArea, uom })}
        >
          {pending ? "Adding…" : "Add asset"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

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
import { shortDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/irrigation")({
  head: () => ({
    meta: [
      { title: "Irrigation — EnvironIQ" },
      {
        name: "description",
        content: "Irrigation controllers and zones per site, with meter readings and anomalies.",
      },
      { property: "og:title", content: "Irrigation — EnvironIQ" },
      {
        property: "og:description",
        content: "Controller inventory and a light meter-reading log.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: IrrigationPage,
});

function IrrigationPage() {
  const { can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [readingOpenFor, setReadingOpenFor] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["irrigation-zones"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("irrigation_zones")
        .select(
          "id, controller_name, valve_count, design_flow_lpm, rainfall_override, notes, maintenance_sites(name), maintenance_zones(name), irrigation_readings(id, reading_date, meter_value, anomaly_flag, notes)",
        )
        .order("controller_name");
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

  const zonesQuery = useQuery({
    queryKey: ["maintenance-zones-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_zones")
        .select("id, name, site_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      siteId: string;
      zoneId: string;
      controllerName: string;
      valveCount: string;
      designFlowLpm: string;
      scheduleNotes: string;
      rainfallOverride: boolean;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("irrigation_zones").insert({
        site_id: form.siteId,
        zone_id: form.zoneId || null,
        controller_name: form.controllerName.trim(),
        valve_count: form.valveCount.trim() ? Number(form.valveCount) : null,
        design_flow_lpm: form.designFlowLpm.trim() ? Number(form.designFlowLpm) : null,
        schedule_notes: form.scheduleNotes.trim() || null,
        rainfall_override: form.rainfallOverride,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Irrigation zone added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["irrigation-zones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logReading = useMutation({
    mutationFn: async (form: {
      irrigationZoneId: string;
      readingDate: string;
      meterValue: string;
      anomalyFlag: boolean;
      notes: string;
    }) => {
      const { error } = await supabase.from("irrigation_readings").insert({
        irrigation_zone_id: form.irrigationZoneId,
        reading_date: form.readingDate || new Date().toISOString().slice(0, 10),
        meter_value: form.meterValue.trim() ? Number(form.meterValue) : null,
        anomaly_flag: form.anomalyFlag,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reading logged");
      setReadingOpenFor(null);
      void queryClient.invalidateQueries({ queryKey: ["irrigation-zones"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Irrigation"
        description="Controllers and zones per site — a light meter-reading log until full IoT telemetry is wired in."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add irrigation zone</Button>
              </DialogTrigger>
              <NewIrrigationZoneDialog
                sites={sitesQuery.data ?? []}
                zones={zonesQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(f) => create.mutate(f)}
              />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No irrigation zones yet"
          description="Add a controller and its zone to start logging meter readings."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((z) => {
            const readings = (z.irrigation_readings ?? [])
              .slice()
              .sort((a, b) => b.reading_date.localeCompare(a.reading_date));
            const latestAnomaly = readings.some((r) => r.anomaly_flag);
            return (
              <div key={z.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold">{z.controller_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {z.maintenance_sites?.name ?? "—"}
                      {z.maintenance_zones?.name ? ` · ${z.maintenance_zones.name}` : ""}
                      {z.valve_count ? ` · ${z.valve_count} valves` : ""}
                      {z.design_flow_lpm ? ` · ${z.design_flow_lpm} LPM design flow` : ""}
                      {latestAnomaly ? " · Anomaly flagged" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {canEdit ? (
                      <Button variant="outline" size="sm" onClick={() => setReadingOpenFor(z.id)}>
                        Log reading
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(expanded === z.id ? null : z.id)}
                    >
                      {readings.length} reading{readings.length === 1 ? "" : "s"}
                    </Button>
                  </div>
                </div>
                {z.notes ? <p className="mt-2 text-sm">{z.notes}</p> : null}
                {expanded === z.id && readings.length > 0 ? (
                  <ul className="mt-3 space-y-2 border-t border-border pt-3">
                    {readings.map((r) => (
                      <li key={r.id} className="text-sm">
                        <span className="font-medium">{shortDate(r.reading_date)}</span>{" "}
                        <span className="text-xs text-muted-foreground">
                          {r.meter_value != null ? `${r.meter_value}` : "no reading"}
                          {r.anomaly_flag ? " · Anomaly" : ""}
                        </span>
                        {r.notes ? (
                          <span className="block text-xs text-muted-foreground">{r.notes}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {readingOpenFor ? (
        <LogReadingDialog
          irrigationZoneId={readingOpenFor}
          pending={logReading.isPending}
          onOpenChange={(o) => !o && setReadingOpenFor(null)}
          onSubmit={(f) => logReading.mutate(f)}
        />
      ) : null}
    </>
  );
}

function NewIrrigationZoneDialog({
  sites,
  zones,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  zones: { id: string; name: string; site_id: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    zoneId: string;
    controllerName: string;
    valveCount: string;
    designFlowLpm: string;
    scheduleNotes: string;
    rainfallOverride: boolean;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [zoneId, setZoneId] = useState("");
  const [controllerName, setControllerName] = useState("");
  const [valveCount, setValveCount] = useState("");
  const [designFlowLpm, setDesignFlowLpm] = useState("");
  const [scheduleNotes, setScheduleNotes] = useState("");
  const [rainfallOverride, setRainfallOverride] = useState(true);

  const relevantZones = zones.filter((z) => !siteId || z.site_id === siteId);

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add irrigation zone</DialogTitle>
        <DialogDescription>
          A controller and the area it waters — link it to a maintenance zone if one exists.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Site</Label>
          <Select
            value={siteId}
            onValueChange={(v) => {
              setSiteId(v);
              setZoneId("");
            }}
          >
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
        <div className="grid gap-2">
          <Label>Zone (optional)</Label>
          <Select value={zoneId} onValueChange={setZoneId}>
            <SelectTrigger>
              <SelectValue placeholder="Not linked to a zone" />
            </SelectTrigger>
            <SelectContent>
              {relevantZones.map((z) => (
                <SelectItem key={z.id} value={z.id}>
                  {z.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="irr-controller">Controller name</Label>
          <Input
            id="irr-controller"
            value={controllerName}
            onChange={(e) => setControllerName(e.target.value)}
            placeholder="Controller 1 — Front lawn"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="irr-valves">Valve count</Label>
            <Input
              id="irr-valves"
              inputMode="numeric"
              value={valveCount}
              onChange={(e) => setValveCount(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="irr-flow">Design flow (LPM)</Label>
            <Input
              id="irr-flow"
              inputMode="decimal"
              value={designFlowLpm}
              onChange={(e) => setDesignFlowLpm(e.target.value)}
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="irr-notes">Schedule notes</Label>
          <Textarea
            id="irr-notes"
            value={scheduleNotes}
            onChange={(e) => setScheduleNotes(e.target.value)}
            rows={2}
            placeholder="Runs 6–7am daily, skips Sundays…"
          />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={rainfallOverride}
            onChange={(e) => setRainfallOverride(e.target.checked)}
          />
          <span>
            Rainfall override enabled
            <span className="block text-xs text-muted-foreground">
              Skips scheduled runs automatically after rain.
            </span>
          </span>
        </label>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !siteId || !controllerName.trim()}
          onClick={() =>
            onSubmit({
              siteId,
              zoneId,
              controllerName: controllerName.trim(),
              valveCount,
              designFlowLpm,
              scheduleNotes,
              rainfallOverride,
            })
          }
        >
          {pending ? "Adding…" : "Add irrigation zone"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function LogReadingDialog({
  irrigationZoneId,
  pending,
  onOpenChange,
  onSubmit,
}: {
  irrigationZoneId: string;
  pending: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (form: {
    irrigationZoneId: string;
    readingDate: string;
    meterValue: string;
    anomalyFlag: boolean;
    notes: string;
  }) => void;
}) {
  const [readingDate, setReadingDate] = useState(new Date().toISOString().slice(0, 10));
  const [meterValue, setMeterValue] = useState("");
  const [anomalyFlag, setAnomalyFlag] = useState(false);
  const [notes, setNotes] = useState("");

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log meter reading</DialogTitle>
          <DialogDescription>
            A manual reading until telemetry is wired in — flag anything that looks off.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="read-date">Date</Label>
              <Input
                id="read-date"
                type="date"
                value={readingDate}
                onChange={(e) => setReadingDate(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="read-value">Meter value</Label>
              <Input
                id="read-value"
                inputMode="decimal"
                value={meterValue}
                onChange={(e) => setMeterValue(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              className="mt-1 accent-primary"
              checked={anomalyFlag}
              onChange={(e) => setAnomalyFlag(e.target.checked)}
            />
            <span>
              Flag as anomaly
              <span className="block text-xs text-muted-foreground">
                Unexpected spike, drop, or a valve stuck open.
              </span>
            </span>
          </label>
          <div className="grid gap-2">
            <Label htmlFor="read-notes">Notes</Label>
            <Textarea
              id="read-notes"
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
              onSubmit({ irrigationZoneId, readingDate, meterValue, anomalyFlag, notes })
            }
          >
            {pending ? "Saving…" : "Save reading"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

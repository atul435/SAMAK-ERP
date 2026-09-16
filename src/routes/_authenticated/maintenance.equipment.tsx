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

export const Route = createFileRoute("/_authenticated/maintenance/equipment")({
  head: () => ({
    meta: [
      { title: "Equipment — EnvironIQ" },
      {
        name: "description",
        content:
          "Mowers, brush cutters, sprayers and other field equipment, and which crew has each.",
      },
      { property: "og:title", content: "Equipment — EnvironIQ" },
      {
        property: "og:description",
        content: "The equipment master — condition and crew assignment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EquipmentPage,
});

const EQUIPMENT_TYPES = [
  "mower",
  "brush_cutter",
  "hedge_trimmer",
  "chainsaw",
  "sprayer",
  "blower",
  "irrigation_pump",
  "generator",
  "vehicle",
  "other",
];
const STATUSES = ["active", "under_repair", "retired"];

function EquipmentPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["maintenance-equipment"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_equipment")
        .select(
          "id, equipment_code, equipment_type, make, model, serial_number, purchase_date, maintenance_interval_hours, total_hours_used, status, maintenance_crew_equipment(maintenance_crews(name))",
        )
        .order("equipment_code");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      equipmentType: string;
      make: string;
      model: string;
      serialNumber: string;
      purchaseDate: string;
      maintenanceIntervalHours: string;
    }) => {
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("maintenance_equipment")
        .select("id", { count: "exact", head: true });
      const code = `EQP-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("maintenance_equipment").insert({
        company_id: employee.company_id,
        equipment_code: code,
        equipment_type: form.equipmentType,
        make: form.make.trim() || null,
        model: form.model.trim() || null,
        serial_number: form.serialNumber.trim() || null,
        purchase_date: form.purchaseDate || null,
        maintenance_interval_hours: form.maintenanceIntervalHours.trim()
          ? Number(form.maintenanceIntervalHours)
          : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipment added");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-equipment"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("maintenance_equipment")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["maintenance-equipment"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Equipment"
        description="The field equipment master — mowers, brush cutters, sprayers and the crew each is assigned to."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add equipment</Button>
              </DialogTrigger>
              <NewEquipmentDialog pending={create.isPending} onSubmit={(f) => create.mutate(f)} />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No equipment yet"
          description="Add mowers, brush cutters, sprayers and other field equipment here, then assign each to a crew."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Equipment</th>
                <th className="px-4 py-2 font-medium">Crew</th>
                <th className="px-4 py-2 font-medium">Purchased</th>
                <th className="px-4 py-2 text-right font-medium">Hours used</th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">
                      {e.make || e.model
                        ? `${e.make ?? ""} ${e.model ?? ""}`.trim()
                        : e.equipment_code}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {e.equipment_code} · {titleCase(e.equipment_type)}
                      {e.serial_number ? ` · ${e.serial_number}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {(e.maintenance_crew_equipment ?? [])
                      .map((c) => c.maintenance_crews?.name)
                      .filter(Boolean)
                      .join(", ") || "Unassigned"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {e.purchase_date ? shortDate(e.purchase_date) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric text-muted-foreground">
                    {e.total_hours_used}
                    {e.maintenance_interval_hours ? ` / ${e.maintenance_interval_hours}` : ""}
                  </td>
                  <td className="px-4 py-2.5">
                    {canEdit ? (
                      <Select
                        value={e.status}
                        onValueChange={(status) => setStatus.mutate({ id: e.id, status })}
                      >
                        <SelectTrigger className="h-7 w-32 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STATUSES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {titleCase(s)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <StatusBadge value={e.status} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function NewEquipmentDialog({
  pending,
  onSubmit,
}: {
  pending: boolean;
  onSubmit: (form: {
    equipmentType: string;
    make: string;
    model: string;
    serialNumber: string;
    purchaseDate: string;
    maintenanceIntervalHours: string;
  }) => void;
}) {
  const [equipmentType, setEquipmentType] = useState("mower");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [maintenanceIntervalHours, setMaintenanceIntervalHours] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add equipment</DialogTitle>
        <DialogDescription>Assign it to a crew from the Crews page.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label>Type</Label>
          <Select value={equipmentType} onValueChange={setEquipmentType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EQUIPMENT_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {titleCase(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="eq-make">Make</Label>
            <Input id="eq-make" value={make} onChange={(e) => setMake(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-model">Model</Label>
            <Input id="eq-model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="eq-serial">Serial number</Label>
          <Input
            id="eq-serial"
            value={serialNumber}
            onChange={(e) => setSerialNumber(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="eq-purchase">Purchase date</Label>
            <Input
              id="eq-purchase"
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="eq-interval">Service interval (hrs)</Label>
            <Input
              id="eq-interval"
              inputMode="decimal"
              value={maintenanceIntervalHours}
              onChange={(e) => setMaintenanceIntervalHours(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending}
          onClick={() =>
            onSubmit({
              equipmentType,
              make,
              model,
              serialNumber,
              purchaseDate,
              maintenanceIntervalHours,
            })
          }
        >
          {pending ? "Adding…" : "Add equipment"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

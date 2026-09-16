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
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/crews")({
  head: () => ({
    meta: [
      { title: "Crews — EnvironIQ" },
      {
        name: "description",
        content: "On-ground execution units — supervisor, members, equipment and assigned sites.",
      },
      { property: "og:title", content: "Crews — EnvironIQ" },
      { property: "og:description", content: "Who executes scheduled visits, and with what." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CrewsPage,
});

const STATUSES = ["active", "inactive"];

function CrewsPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [memberOpenFor, setMemberOpenFor] = useState<string | null>(null);
  const [equipmentOpenFor, setEquipmentOpenFor] = useState<string | null>(null);
  const [siteOpenFor, setSiteOpenFor] = useState<string | null>(null);

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["maintenance-crews"] });

  const query = useQuery({
    queryKey: ["maintenance-crews"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_crews")
        .select(
          "id, crew_code, name, default_region, status, notes, area_manager:area_manager_employee_id(full_name), supervisor:supervisor_employee_id(full_name), maintenance_crew_members(id, role_on_crew, employees(id, full_name)), maintenance_crew_equipment(id, maintenance_equipment(id, equipment_code, equipment_type)), maintenance_crew_sites(id, maintenance_sites(id, name))",
        )
        .order("crew_code");
      if (error) throw error;
      return data;
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees-lite"],
    enabled: open || !!memberOpenFor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const equipmentQuery = useQuery({
    queryKey: ["maintenance-equipment-lite"],
    enabled: !!equipmentOpenFor,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_equipment")
        .select("id, equipment_code, equipment_type")
        .order("equipment_code");
      if (error) throw error;
      return data;
    },
  });

  const sitesQuery = useQuery({
    queryKey: ["maintenance-sites-lite"],
    enabled: !!siteOpenFor,
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
      name: string;
      areaManagerId: string;
      supervisorId: string;
      defaultRegion: string;
      notes: string;
    }) => {
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("maintenance_crews")
        .select("id", { count: "exact", head: true });
      const code = `CRW-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("maintenance_crews").insert({
        company_id: employee.company_id,
        crew_code: code,
        name: form.name.trim(),
        area_manager_employee_id: form.areaManagerId || null,
        supervisor_employee_id: form.supervisorId || null,
        default_region: form.defaultRegion.trim() || null,
        notes: form.notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Crew added");
      setOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("maintenance_crews").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const addMember = useMutation({
    mutationFn: async (form: { crewId: string; employeeId: string; roleOnCrew: string }) => {
      if (!form.employeeId) throw new Error("Pick an employee.");
      const { error } = await supabase.from("maintenance_crew_members").insert({
        crew_id: form.crewId,
        employee_id: form.employeeId,
        role_on_crew: form.roleOnCrew.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member added");
      setMemberOpenFor(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_crew_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const assignEquipment = useMutation({
    mutationFn: async (form: { crewId: string; equipmentId: string }) => {
      if (!form.equipmentId) throw new Error("Pick an equipment item.");
      const { error } = await supabase.from("maintenance_crew_equipment").insert({
        crew_id: form.crewId,
        equipment_id: form.equipmentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Equipment assigned");
      setEquipmentOpenFor(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassignEquipment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_crew_equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const assignSite = useMutation({
    mutationFn: async (form: { crewId: string; siteId: string }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("maintenance_crew_sites").insert({
        crew_id: form.crewId,
        site_id: form.siteId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Site assigned");
      setSiteOpenFor(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const unassignSite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("maintenance_crew_sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Crews"
        description="On-ground execution units — a supervisor, members, assigned equipment and the sites they service."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Add crew</Button>
              </DialogTrigger>
              <NewCrewDialog
                employees={employeesQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(f) => create.mutate(f)}
              />
            </Dialog>
          ) : null
        }
      />
      {rows.length === 0 ? (
        <EmptyState
          title="No crews yet"
          description="Add a crew, then assign members, equipment and the sites they service."
        />
      ) : (
        <div className="space-y-3">
          {rows.map((c) => {
            const members = c.maintenance_crew_members ?? [];
            const equipment = c.maintenance_crew_equipment ?? [];
            const sites = c.maintenance_crew_sites ?? [];
            const isOpen = expanded === c.id;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.crew_code}
                      {c.default_region ? ` · ${c.default_region}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Area manager: {c.area_manager?.full_name ?? "—"} · Supervisor:{" "}
                      {c.supervisor?.full_name ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={c.status}
                        onValueChange={(status) => setStatus.mutate({ id: c.id, status })}
                      >
                        <SelectTrigger className="h-7 w-28 text-xs">
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
                      <StatusBadge value={c.status} />
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpanded(isOpen ? null : c.id)}
                    >
                      {members.length} members · {equipment.length} equipment · {sites.length} sites
                    </Button>
                  </div>
                </div>

                {isOpen ? (
                  <div className="mt-4 grid gap-4 border-t border-border pt-4 md:grid-cols-3">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Members
                        </p>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setMemberOpenFor(c.id)}
                          >
                            + Add
                          </Button>
                        ) : null}
                      </div>
                      {members.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No members yet.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {members.map((m) => (
                            <li
                              key={m.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {m.employees?.full_name ?? "—"}
                                {m.role_on_crew ? (
                                  <span className="text-xs text-muted-foreground">
                                    {" "}
                                    ({m.role_on_crew})
                                  </span>
                                ) : null}
                              </span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-destructive"
                                  onClick={() => removeMember.mutate(m.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Equipment
                        </p>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setEquipmentOpenFor(c.id)}
                          >
                            + Assign
                          </Button>
                        ) : null}
                      </div>
                      {equipment.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No equipment assigned.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {equipment.map((e) => (
                            <li
                              key={e.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>
                                {e.maintenance_equipment?.equipment_code}
                                <span className="text-xs text-muted-foreground">
                                  {" "}
                                  ({titleCase(e.maintenance_equipment?.equipment_type ?? "")})
                                </span>
                              </span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-destructive"
                                  onClick={() => unassignEquipment.mutate(e.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                          Sites serviced
                        </p>
                        {canEdit ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setSiteOpenFor(c.id)}
                          >
                            + Assign
                          </Button>
                        ) : null}
                      </div>
                      {sites.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No sites assigned.</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {sites.map((s) => (
                            <li
                              key={s.id}
                              className="flex items-center justify-between gap-2 text-sm"
                            >
                              <span>{s.maintenance_sites?.name}</span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  className="text-xs text-muted-foreground hover:text-destructive"
                                  onClick={() => unassignSite.mutate(s.id)}
                                >
                                  Remove
                                </button>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {memberOpenFor ? (
        <Dialog open onOpenChange={(o) => !o && setMemberOpenFor(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Add member</DialogTitle>
              <DialogDescription>Add an employee to this crew.</DialogDescription>
            </DialogHeader>
            <AddMemberForm
              employees={employeesQuery.data ?? []}
              pending={addMember.isPending}
              onSubmit={(f) => addMember.mutate({ crewId: memberOpenFor, ...f })}
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {equipmentOpenFor ? (
        <Dialog open onOpenChange={(o) => !o && setEquipmentOpenFor(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign equipment</DialogTitle>
              <DialogDescription>Assign an equipment item to this crew.</DialogDescription>
            </DialogHeader>
            <AssignEquipmentForm
              equipment={equipmentQuery.data ?? []}
              pending={assignEquipment.isPending}
              onSubmit={(equipmentId) =>
                assignEquipment.mutate({ crewId: equipmentOpenFor, equipmentId })
              }
            />
          </DialogContent>
        </Dialog>
      ) : null}

      {siteOpenFor ? (
        <Dialog open onOpenChange={(o) => !o && setSiteOpenFor(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign site</DialogTitle>
              <DialogDescription>Assign a site this crew services.</DialogDescription>
            </DialogHeader>
            <AssignSiteForm
              sites={sitesQuery.data ?? []}
              pending={assignSite.isPending}
              onSubmit={(siteId) => assignSite.mutate({ crewId: siteOpenFor, siteId })}
            />
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function NewCrewDialog({
  employees,
  pending,
  onSubmit,
}: {
  employees: { id: string; full_name: string }[];
  pending: boolean;
  onSubmit: (form: {
    name: string;
    areaManagerId: string;
    supervisorId: string;
    defaultRegion: string;
    notes: string;
  }) => void;
}) {
  const [name, setName] = useState("");
  const [areaManagerId, setAreaManagerId] = useState("");
  const [supervisorId, setSupervisorId] = useState("");
  const [defaultRegion, setDefaultRegion] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Add crew</DialogTitle>
        <DialogDescription>
          A crew executes scheduled visits — add members and equipment once it's created.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="crew-name">Crew name</Label>
          <Input
            id="crew-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Gurugram Maintenance Group 1"
          />
        </div>
        <div className="grid gap-2">
          <Label>Area manager (optional)</Label>
          <Select value={areaManagerId} onValueChange={setAreaManagerId}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Supervisor (optional)</Label>
          <Select value={supervisorId} onValueChange={setSupervisorId}>
            <SelectTrigger>
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="crew-region">Default region</Label>
          <Input
            id="crew-region"
            value={defaultRegion}
            onChange={(e) => setDefaultRegion(e.target.value)}
            placeholder="Gurugram South"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="crew-notes">Notes</Label>
          <Textarea
            id="crew-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim()}
          onClick={() =>
            onSubmit({ name: name.trim(), areaManagerId, supervisorId, defaultRegion, notes })
          }
        >
          {pending ? "Adding…" : "Add crew"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddMemberForm({
  employees,
  pending,
  onSubmit,
}: {
  employees: { id: string; full_name: string }[];
  pending: boolean;
  onSubmit: (form: { employeeId: string; roleOnCrew: string }) => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [roleOnCrew, setRoleOnCrew] = useState("");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Employee</Label>
        <Select value={employeeId} onValueChange={setEmployeeId}>
          <SelectTrigger>
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="member-role">Role on crew</Label>
        <Input
          id="member-role"
          value={roleOnCrew}
          onChange={(e) => setRoleOnCrew(e.target.value)}
          placeholder="Gardener / Irrigation tech / Arborist…"
        />
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !employeeId}
          onClick={() => onSubmit({ employeeId, roleOnCrew })}
        >
          {pending ? "Adding…" : "Add member"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AssignEquipmentForm({
  equipment,
  pending,
  onSubmit,
}: {
  equipment: { id: string; equipment_code: string; equipment_type: string }[];
  pending: boolean;
  onSubmit: (equipmentId: string) => void;
}) {
  const [equipmentId, setEquipmentId] = useState("");

  return (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label>Equipment</Label>
        <Select value={equipmentId} onValueChange={setEquipmentId}>
          <SelectTrigger>
            <SelectValue placeholder="Select equipment" />
          </SelectTrigger>
          <SelectContent>
            {equipment.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.equipment_code} — {titleCase(e.equipment_type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button disabled={pending || !equipmentId} onClick={() => onSubmit(equipmentId)}>
          {pending ? "Assigning…" : "Assign equipment"}
        </Button>
      </DialogFooter>
    </div>
  );
}

function AssignSiteForm({
  sites,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (siteId: string) => void;
}) {
  const [siteId, setSiteId] = useState("");

  return (
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
      <DialogFooter>
        <Button disabled={pending || !siteId} onClick={() => onSubmit(siteId)}>
          {pending ? "Assigning…" : "Assign site"}
        </Button>
      </DialogFooter>
    </div>
  );
}

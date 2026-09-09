import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth-context";
import {
  createStaffAccount,
  listAccountAuthInfo,
  resetAccountPassword,
  setAccountBlocked,
} from "@/lib/admin-users.functions";
import {
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  ROLE_PROFILES,
  passwordIssue,
  roleDisplay,
} from "@/lib/user-management";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { dateTime, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "User management — logins, roles and access" },
      {
        name: "description",
        content:
          "Create staff logins, grant roles, block accounts and tune the module-by-module access matrix for Samak Landscape.",
      },
      { property: "og:title", content: "User management — logins, roles and access" },
      {
        property: "og:description",
        content: "Staff logins, role grants, blocked accounts and the module access matrix.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: UserManagementPage,
});

interface EmployeeRow {
  id: string;
  employee_code: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  primary_role: string | null;
  is_active: boolean | null;
  user_id: string | null;
  departments: { name: string } | null;
}

function UserManagementPage() {
  const { can, session } = useAuth();
  const manage = can("admin", "edit");
  const queryClient = useQueryClient();
  const fetchAuthInfo = useServerFn(listAccountAuthInfo);

  const [term, setTerm] = useState("");
  const [tab, setTab] = useState("accounts");

  const directory = useQuery({
    queryKey: ["user-management-directory"],
    queryFn: async () => {
      const [employees, roles, departments] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id, employee_code, full_name, email, phone, designation, primary_role, is_active, user_id, departments!employees_department_id_fkey(name)",
          )
          .order("full_name"),
        supabase.from("user_roles").select("id, user_id, role"),
        supabase.from("departments").select("id, name").order("name"),
      ]);
      if (employees.error) throw employees.error;
      if (roles.error) throw roles.error;
      return {
        employees: (employees.data ?? []) as unknown as EmployeeRow[],
        roles: roles.data ?? [],
        departments: departments.data ?? [],
      };
    },
  });

  const authInfo = useQuery({
    queryKey: ["user-management-auth"],
    enabled: manage,
    queryFn: () => fetchAuthInfo(),
    retry: false,
  });

  const rolesByUser = useMemo(() => {
    const map = new Map<string, AppRole[]>();
    for (const r of directory.data?.roles ?? []) {
      if (!r.user_id) continue;
      map.set(r.user_id, [...(map.get(r.user_id) ?? []), r.role as AppRole]);
    }
    return map;
  }, [directory.data]);

  const authByUser = useMemo(() => {
    const map = new Map<string, NonNullable<typeof authInfo.data>[number]>();
    for (const a of authInfo.data ?? []) map.set(a.userId, a);
    return map;
  }, [authInfo.data]);

  if (directory.isLoading) return <LoadingState label="Loading user accounts…" />;
  if (directory.isError) return <ErrorState message={(directory.error as Error).message} />;

  const employees = directory.data!.employees;
  const rows = employees.filter((e) =>
    `${e.full_name} ${e.employee_code} ${e.email ?? ""} ${e.designation ?? ""}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );

  const withLogin = employees.filter((e) => e.user_id).length;
  const blocked = employees.filter(
    (e) => e.is_active === false || (e.user_id && authByUser.get(e.user_id)?.blocked),
  ).length;

  return (
    <>
      <PageHeader
        title="User management"
        description="Every login into the ERP: who they are, what role they hold, when they last signed in, and exactly which modules that role can open."
        actions={
          manage ? (
            <CreateAccountDialog
              departments={directory.data!.departments}
              onDone={() => {
                void queryClient.invalidateQueries({ queryKey: ["user-management-directory"] });
                void queryClient.invalidateQueries({ queryKey: ["user-management-auth"] });
              }}
            />
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatCard label="People on record" value={employees.length} />
        <StatCard label="With a login" value={withLogin} />
        <StatCard label="Blocked" value={blocked} />
        <StatCard label="Roles defined" value={ROLE_PROFILES.length} />
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-2">
        <TabsList>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="hierarchy">Role hierarchy</TabsTrigger>
          <TabsTrigger value="matrix">Access matrix</TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-3">
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search by name, code or email…"
            className="max-w-xs"
          />
          {rows.length === 0 ? (
            <EmptyState title="No accounts match that search" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">User</th>
                    <th className="px-4 py-2 font-medium">Roles</th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">Team</th>
                    <th className="hidden px-4 py-2 font-medium lg:table-cell">Last sign-in</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    {manage ? <th className="px-4 py-2 text-right font-medium">Manage</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((e) => {
                    const granted = e.user_id ? (rolesByUser.get(e.user_id) ?? []) : [];
                    const auth = e.user_id ? authByUser.get(e.user_id) : undefined;
                    const isBlocked = e.is_active === false || Boolean(auth?.blocked);
                    return (
                      <tr
                        key={e.id}
                        className="border-b border-border last:border-0 hover:bg-secondary/50"
                      >
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{e.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {e.email ?? "no email"} · {e.employee_code}
                          </p>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex flex-wrap gap-1">
                            {(granted.length ? granted : [e.primary_role as AppRole]).map((r) =>
                              r ? (
                                <Badge key={r} variant="secondary">
                                  {roleDisplay(r)}
                                </Badge>
                              ) : null,
                            )}
                            {!granted.length ? (
                              <span className="text-xs text-muted-foreground">no login role</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                          {e.departments?.name ?? "—"}
                        </td>
                        <td className="hidden px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">
                          {e.user_id ? dateTime(auth?.lastSignInAt ?? null) : "no login yet"}
                        </td>
                        <td className="px-4 py-2.5">
                          {!e.user_id ? (
                            <Badge variant="outline">Invited / no login</Badge>
                          ) : isBlocked ? (
                            <Badge variant="destructive">Blocked</Badge>
                          ) : (
                            <Badge>Active</Badge>
                          )}
                        </td>
                        {manage ? (
                          <td className="px-4 py-2.5 text-right">
                            <RowActions
                              employee={e}
                              granted={granted}
                              blocked={isBlocked}
                              isSelf={Boolean(e.user_id && e.user_id === session?.user.id)}
                            />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {manage && authInfo.isError ? (
            <p className="text-xs text-muted-foreground">
              Sign-in history is unavailable right now, so accounts show their record status only.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="hierarchy">
          <div className="grid gap-3 lg:grid-cols-2">
            {ROLE_PROFILES.map((r) => {
              const count = [...rolesByUser.values()].filter((list) => list.includes(r.role)).length;
              return (
                <section key={r.role} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-base font-semibold">{r.display}</h2>
                      <p className="text-xs text-muted-foreground">{r.level}</p>
                    </div>
                    <Badge variant="outline">
                      {count} {count === 1 ? "user" : "users"}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>
                </section>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="matrix">
          <AccessMatrix canEdit={manage} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

function RowActions({
  employee,
  granted,
  blocked,
  isSelf,
}: {
  employee: EmployeeRow;
  granted: AppRole[];
  blocked: boolean;
  isSelf: boolean;
}) {
  const queryClient = useQueryClient();
  const [rolesOpen, setRolesOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<AppRole[]>(granted);
  const resetPwd = useServerFn(resetAccountPassword);
  const setBlocked = useServerFn(setAccountBlocked);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["user-management-directory"] });
    void queryClient.invalidateQueries({ queryKey: ["user-management-auth"] });
  };

  const saveRoles = useMutation({
    mutationFn: async () => {
      if (!employee.user_id) throw new Error("This person has no login yet.");
      const add = selected.filter((r) => !granted.includes(r));
      const remove = granted.filter((r) => !selected.includes(r));
      if (remove.length) {
        const { error } = await supabase
          .from("user_roles")
          .delete()
          .eq("user_id", employee.user_id)
          .in("role", remove);
        if (error) throw error;
      }
      if (add.length) {
        const { error } = await supabase
          .from("user_roles")
          .insert(add.map((role) => ({ user_id: employee.user_id!, role })));
        if (error) throw error;
      }
      if (selected[0]) {
        await supabase
          .from("employees")
          .update({ primary_role: selected[0] })
          .eq("id", employee.id);
      }
    },
    onSuccess: () => {
      toast.success("Roles updated.");
      setRolesOpen(false);
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update roles."),
  });

  const changePassword = useMutation({
    mutationFn: async () => {
      if (!employee.user_id) throw new Error("This person has no login yet.");
      const issue = passwordIssue(password);
      if (issue) throw new Error(issue);
      await resetPwd({ data: { userId: employee.user_id, password } });
    },
    onSuccess: () => {
      toast.success("Password changed. Share it with them privately.");
      setPwdOpen(false);
      setPassword("");
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not change the password."),
  });

  const toggleBlocked = useMutation({
    mutationFn: async (next: boolean) => {
      if (!employee.user_id) throw new Error("This person has no login yet.");
      await setBlocked({ data: { userId: employee.user_id, blocked: next } });
    },
    onSuccess: () => {
      toast.success("Access updated.");
      refresh();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update access."),
  });

  if (!employee.user_id) {
    return <span className="text-xs text-muted-foreground">No login</span>;
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <Dialog
        open={rolesOpen}
        onOpenChange={(o) => {
          setRolesOpen(o);
          if (o) setSelected(granted);
        }}
      >
        <Button variant="outline" size="sm" onClick={() => setRolesOpen(true)}>
          Roles
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Roles for {employee.full_name}</DialogTitle>
            <DialogDescription>
              The first role selected becomes their main job title. Access follows the matrix.
            </DialogDescription>
          </DialogHeader>
          <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2">
            {ROLE_PROFILES.map((r) => (
              <label key={r.role} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(r.role)}
                  onCheckedChange={(v) =>
                    setSelected((prev) =>
                      v ? [...prev, r.role] : prev.filter((x) => x !== r.role),
                    )
                  }
                />
                {r.display}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={() => saveRoles.mutate()} disabled={saveRoles.isPending}>
              {saveRoles.isPending ? "Saving…" : "Save roles"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <Button variant="outline" size="sm" onClick={() => setPwdOpen(true)}>
          Password
        </Button>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set a new password</DialogTitle>
            <DialogDescription>
              {employee.full_name} can sign in with this immediately. Ask them to change it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button onClick={() => changePassword.mutate()} disabled={changePassword.isPending}>
              {changePassword.isPending ? "Saving…" : "Set password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex items-center gap-1.5">
        <Switch
          checked={!blocked}
          disabled={isSelf || toggleBlocked.isPending}
          onCheckedChange={(v) => toggleBlocked.mutate(!v)}
          aria-label="Allow sign-in"
        />
        <span className="text-xs text-muted-foreground">{blocked ? "Blocked" : "Allowed"}</span>
      </div>
    </div>
  );
}

function CreateAccountDialog({
  departments,
  onDone,
}: {
  departments: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    employeeCode: "",
    designation: "",
    phone: "",
    role: "site_engineer",
    departmentId: "",
  });
  const create = useServerFn(createStaffAccount);

  const mutation = useMutation({
    mutationFn: async () => {
      const issue = passwordIssue(form.password);
      if (issue) throw new Error(issue);
      await create({
        data: {
          fullName: form.fullName.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          role: form.role,
          employeeCode: form.employeeCode.trim(),
          ...(form.designation ? { designation: form.designation } : {}),
          ...(form.phone ? { phone: form.phone } : {}),
          ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        },
      });
    },
    onSuccess: () => {
      toast.success("Account created. Share the password privately.");
      setOpen(false);
      setForm({
        fullName: "",
        email: "",
        password: "",
        employeeCode: "",
        designation: "",
        phone: "",
        role: "site_engineer",
        departmentId: "",
      });
      onDone();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Could not create the account."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Add user</Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add a staff login</DialogTitle>
          <DialogDescription>
            Creates the sign-in, the employee record and the role grant together.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Full name">
            <Input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
          </Field>
          <Field label="Employee code">
            <Input
              value={form.employeeCode}
              onChange={(e) => setForm({ ...form, employeeCode: e.target.value })}
              placeholder="SLPL-021"
            />
          </Field>
          <Field label="Work email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </Field>
          <Field label="Temporary password">
            <Input
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              autoComplete="new-password"
            />
          </Field>
          <Field label="Role">
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_PROFILES.map((r) => (
                  <SelectItem key={r.role} value={r.role}>
                    {r.display}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Team">
            <Select
              value={form.departmentId || "none"}
              onValueChange={(v) => setForm({ ...form, departmentId: v === "none" ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No team</SelectItem>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Designation">
            <Input
              value={form.designation}
              onChange={(e) => setForm({ ...form, designation: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={() => mutation.mutate()}
            disabled={
              mutation.isPending || !form.fullName || !form.email || !form.employeeCode || !form.password
            }
          >
            {mutation.isPending ? "Creating…" : "Create account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function AccessMatrix({ canEdit }: { canEdit: boolean }) {
  const queryClient = useQueryClient();
  const [role, setRole] = useState<string>(ROLE_PROFILES[0]!.role);

  const query = useQuery({
    queryKey: ["role-permissions-matrix"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("id, role, module, action");
      if (error) throw error;
      return data;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      module,
      action,
      on,
    }: {
      module: string;
      action: string;
      on: boolean;
    }) => {
      if (on) {
        const { error } = await supabase
          .from("role_permissions")
          .insert({ role: role as AppRole, module, action });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("role_permissions")
          .delete()
          .eq("role", role as AppRole)
          .eq("module", module)
          .eq("action", action);
        if (error) throw error;
      }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["role-permissions-matrix"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not change access."),
  });

  if (query.isLoading) return <LoadingState label="Loading the access matrix…" />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const set = new Set(
    (query.data ?? []).filter((p) => p.role === role).map((p) => `${p.module}:${p.action}`),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_PROFILES.map((r) => (
              <SelectItem key={r.role} value={r.role}>
                {r.display}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {canEdit
            ? "Tick a box to give this role that action across the module."
            : "Read-only view — only an administrator can change access."}
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
            <tr className="border-b border-border">
              <th className="px-3 py-2 font-medium">Module</th>
              {PERMISSION_ACTIONS.map((a) => (
                <th key={a} className="px-2 py-2 text-center font-medium">
                  {titleCase(a)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((m) => (
              <tr key={m} className="border-b border-border last:border-0">
                <td className="px-3 py-2 font-medium">{titleCase(m)}</td>
                {PERMISSION_ACTIONS.map((a) => (
                  <td key={a} className="px-2 py-2 text-center">
                    <Checkbox
                      checked={set.has(`${m}:${a}`)}
                      disabled={!canEdit || toggle.isPending}
                      onCheckedChange={(v) =>
                        toggle.mutate({ module: m, action: a, on: Boolean(v) })
                      }
                      aria-label={`${m} ${a}`}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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

export const Route = createFileRoute("/_authenticated/admin/portal")({
  head: () => ({
    meta: [
      { title: "Portal accounts — client and partner logins" },
      {
        name: "description",
        content:
          "Invite clients and supply partners to their own secure portal and control which company records each login can see.",
      },
      { property: "og:title", content: "Portal accounts — client and partner logins" },
      {
        property: "og:description",
        content: "Manage client and vendor portal logins for Samak Landscape.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PortalAccountsPage,
});

function PortalAccountsPage() {
  const { can, employee } = useAuth();
  const canEdit = can("crm", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [portalType, setPortalType] = useState("client");
  const [targetId, setTargetId] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [designation, setDesignation] = useState("");

  const query = useQuery({
    queryKey: ["portal-accounts"],
    queryFn: async () => {
      const [accounts, clients, vendors] = await Promise.all([
        supabase
          .from("portal_users")
          .select(
            "id, portal_type, full_name, email, designation, is_active, user_id, created_at, clients(name), vendors(name)",
          )
          .order("created_at", { ascending: false }),
        supabase.from("clients").select("id, name").eq("is_archived", false).order("name"),
        supabase.from("vendors").select("id, name").eq("is_archived", false).order("name"),
      ]);
      if (accounts.error) throw accounts.error;
      return {
        accounts: accounts.data ?? [],
        clients: clients.data ?? [],
        vendors: vendors.data ?? [],
      };
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!employee?.company_id) throw new Error("Missing company.");
      const { error } = await supabase.from("portal_users").insert({
        company_id: employee.company_id,
        portal_type: portalType,
        client_id: portalType === "client" ? targetId : null,
        vendor_id: portalType === "vendor" ? targetId : null,
        full_name: fullName,
        email: email.trim().toLowerCase(),
        designation: designation || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Portal account created. Ask them to sign up with this email.");
      setOpen(false);
      setFullName("");
      setEmail("");
      setDesignation("");
      setTargetId("");
      void queryClient.invalidateQueries({ queryKey: ["portal-accounts"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not create account."),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("portal_users")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["portal-accounts"] }),
    onError: (err) => toast.error(err instanceof Error ? err.message : "Could not update access."),
  });

  if (query.isLoading) return <LoadingState label="Loading portal accounts…" />;
  if (query.error) return <ErrorState message="Could not load portal accounts." />;
  const { accounts, clients, vendors } = query.data!;
  const options = portalType === "client" ? clients : vendors;

  return (
    <>
      <PageHeader
        title="Portal accounts"
        description="Client and supply-partner logins. Each account sees only its own projects, invoices, orders and payments."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Invite portal user</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite a portal user</DialogTitle>
                  <DialogDescription>
                    They sign up on the normal sign-in page with this exact email and are taken
                    straight to their portal.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Portal</Label>
                    <Select
                      value={portalType}
                      onValueChange={(v) => {
                        setPortalType(v);
                        setTargetId("");
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Client portal</SelectItem>
                        <SelectItem value="vendor">Partner (vendor) portal</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{portalType === "client" ? "Client" : "Vendor"}</Label>
                    <Select value={targetId} onValueChange={setTargetId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select organisation" />
                      </SelectTrigger>
                      <SelectContent>
                        {options.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pu-name">Full name</Label>
                    <Input
                      id="pu-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pu-email">Email</Label>
                    <Input
                      id="pu-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pu-desig">Designation</Label>
                    <Input
                      id="pu-desig"
                      value={designation}
                      onChange={(e) => setDesignation(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => create.mutate()}
                    disabled={!targetId || !fullName || !email || create.isPending}
                  >
                    {create.isPending ? "Saving…" : "Create account"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          title="No portal accounts yet"
          description="Invite a client or supply partner to give them their own secure view."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Portal</th>
                <th className="px-4 py-2 text-left font-medium">Organisation</th>
                <th className="px-4 py-2 text-left font-medium">Signed up</th>
                <th className="px-4 py-2 text-left font-medium">Invited</th>
                <th className="px-4 py-2 text-right font-medium">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {accounts.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 font-medium">
                    {a.full_name}
                    {a.designation ? (
                      <span className="block text-xs text-muted-foreground">{a.designation}</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{a.email}</td>
                  <td className="px-4 py-2">{titleCase(a.portal_type)}</td>
                  <td className="px-4 py-2">{a.clients?.name ?? a.vendors?.name ?? "—"}</td>
                  <td className="px-4 py-2">{a.user_id ? "Yes" : "Pending"}</td>
                  <td className="px-4 py-2">{shortDate(a.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Button
                      variant={a.is_active ? "outline" : "default"}
                      size="sm"
                      disabled={!canEdit || toggle.isPending}
                      onClick={() => toggle.mutate({ id: a.id, active: !a.is_active })}
                    >
                      {a.is_active ? "Revoke" : "Restore"}
                    </Button>
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

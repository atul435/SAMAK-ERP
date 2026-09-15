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
import { inr, shortDate, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/maintenance/issues")({
  head: () => ({
    meta: [
      { title: "Maintenance Issues — EnvironIQ" },
      {
        name: "description",
        content: "Issues from inspections, client requests and staff reports, through to closure.",
      },
      { property: "og:title", content: "Maintenance Issues — EnvironIQ" },
      { property: "og:description", content: "Triage, extra-work approval, dispatch and closure." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaintenanceIssuesPage,
});

const SOURCES = ["inspection", "client_request", "staff_report", "sensor", "other"];
const SEVERITIES = ["low", "medium", "high", "critical"];
const STATUSES = [
  "open",
  "triaged",
  "approved",
  "dispatched",
  "in_progress",
  "verified",
  "closed",
  "reopened",
];

function MaintenanceIssuesPage() {
  const { employee, can } = useAuth();
  const canEdit = can("care", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("open");

  const query = useQuery({
    queryKey: ["maintenance-issues-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_issues")
        .select(
          "id, title, source, severity, status, is_extra_work, estimated_cost, approval_request_id, created_at, maintenance_sites(name)",
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
        .select("id, name, company_id")
        .eq("is_archived", false)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      siteId: string;
      title: string;
      description: string;
      source: string;
      severity: string;
      isExtraWork: boolean;
      estimatedCost: string;
    }) => {
      if (!form.siteId) throw new Error("Pick a site.");
      const { error } = await supabase.from("maintenance_issues").insert({
        site_id: form.siteId,
        title: form.title.trim(),
        description: form.description.trim() || null,
        source: form.source,
        severity: form.severity,
        owner_employee_id: employee?.id ?? null,
        is_extra_work: form.isExtraWork,
        estimated_cost: form.estimatedCost.trim() ? Number(form.estimatedCost) : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue logged");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["maintenance-issues-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const patch: { status: string; closed_at?: string } = { status };
      if (status === "closed") patch.closed_at = new Date().toISOString();
      const { error } = await supabase.from("maintenance_issues").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["maintenance-issues-all"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const requestApproval = useMutation({
    mutationFn: async (issue: { id: string; title: string; estimated_cost: number | null }) => {
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("approval_requests")
        .select("id", { count: "exact", head: true });
      const requestCode = `APR-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { data: approval, error } = await supabase
        .from("approval_requests")
        .insert({
          company_id: employee.company_id,
          request_code: requestCode,
          entity_type: "maintenance_issue",
          entity_id: issue.id,
          entity_label: issue.title,
          amount: issue.estimated_cost,
          summary: `Extra work approval for maintenance issue: ${issue.title}`,
          state: "pending_approval",
          requested_by: employee.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      const { error: issueError } = await supabase
        .from("maintenance_issues")
        .update({ approval_request_id: approval.id, status: "triaged" })
        .eq("id", issue.id);
      if (issueError) throw issueError;
    },
    onSuccess: () => {
      toast.success("Sent for approval");
      void queryClient.invalidateQueries({ queryKey: ["maintenance-issues-all"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((i) => {
    if (filter === "all") return true;
    if (filter === "open") return !["closed", "verified"].includes(i.status);
    return i.status === filter;
  });

  return (
    <>
      <PageHeader
        title="Maintenance Issues"
        description="Inspection failures, client requests and staff reports — triaged through to closure. Extra work needs written client approval before routine execution."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Log issue</Button>
              </DialogTrigger>
              <NewIssueDialog
                sites={sitesQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(f) => create.mutate(f)}
              />
            </Dialog>
          ) : null
        }
      />

      <Select value={filter} onValueChange={setFilter}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="open">Open</SelectItem>
          <SelectItem value="all">All</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {titleCase(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {rows.length === 0 ? (
        <EmptyState
          title="No issues in this view"
          description="Change the filter or log an issue."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Issue</th>
                <th className="px-4 py-2 font-medium">Site</th>
                <th className="px-4 py-2 font-medium">Severity</th>
                <th className="px-4 py-2 text-right font-medium">Est. cost</th>
                <th className="px-4 py-2 font-medium">Status</th>
                {canEdit ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((i) => (
                <tr
                  key={i.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {titleCase(i.source)} · {shortDate(i.created_at)}
                      {i.is_extra_work ? " · Extra work" : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {i.maintenance_sites?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{titleCase(i.severity)}</td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {i.estimated_cost ? inr(Number(i.estimated_cost), true) : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusBadge value={i.status} />
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {i.is_extra_work && !i.approval_request_id ? (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={requestApproval.isPending}
                          onClick={() =>
                            requestApproval.mutate({
                              id: i.id,
                              title: i.title,
                              estimated_cost: i.estimated_cost,
                            })
                          }
                        >
                          Send for approval
                        </Button>
                      ) : (
                        <Select
                          value={i.status}
                          onValueChange={(status) => setStatus.mutate({ id: i.id, status })}
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
                      )}
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

function NewIssueDialog({
  sites,
  pending,
  onSubmit,
}: {
  sites: { id: string; name: string }[];
  pending: boolean;
  onSubmit: (form: {
    siteId: string;
    title: string;
    description: string;
    source: string;
    severity: string;
    isExtraWork: boolean;
    estimatedCost: string;
  }) => void;
}) {
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [source, setSource] = useState("staff_report");
  const [severity, setSeverity] = useState("medium");
  const [isExtraWork, setIsExtraWork] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState("");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Log issue</DialogTitle>
        <DialogDescription>
          From an inspection failure, client request, staff report or sensor alert.
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
        <div className="grid gap-2">
          <Label htmlFor="issue-title">Title</Label>
          <Input
            id="issue-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Leaking valve near clubhouse entrance"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
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
          <Label htmlFor="issue-desc">Description</Label>
          <Textarea
            id="issue-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
        <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 accent-primary"
            checked={isExtraWork}
            onChange={(e) => setIsExtraWork(e.target.checked)}
          />
          <span>
            This is extra work outside the signed contract scope
            <span className="block text-xs text-muted-foreground">
              Needs written client approval before routine execution.
            </span>
          </span>
        </label>
        {isExtraWork ? (
          <div className="grid gap-2">
            <Label htmlFor="issue-cost">Estimated cost ₹</Label>
            <Input
              id="issue-cost"
              inputMode="decimal"
              value={estimatedCost}
              onChange={(e) => setEstimatedCost(e.target.value)}
            />
          </div>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !siteId || !title.trim()}
          onClick={() =>
            onSubmit({
              siteId,
              title: title.trim(),
              description,
              source,
              severity,
              isExtraWork,
              estimatedCost,
            })
          }
        >
          {pending ? "Logging…" : "Log issue"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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

export const STAGES = ["concept", "schematic", "detailed", "tender", "as_built"] as const;
export const DESIGN_TYPES = ["softscape", "hardscape", "irrigation", "lighting", "combined"] as const;

export const Route = createFileRoute("/_authenticated/design/")({
  head: () => ({
    meta: [
      { title: "Design Studio — EnvironIQ" },
      {
        name: "description",
        content:
          "Landscape design register linking every site plan, elevation and plant schedule to its Samak project, client and revision history.",
      },
      { property: "og:title", content: "Design Studio — EnvironIQ" },
      {
        property: "og:description",
        content: "Site plans, elevations and plant schedules linked to live projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DesignStudio,
});

function DesignStudio() {
  const { can, employee } = useAuth();
  const canEdit = can("design", "edit");
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["designs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select(
          "id, design_code, title, design_type, stage, scale, status, approval_state, current_revision, updated_at, projects(name, project_code), clients(name), employees:designer_id(full_name)",
        )
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, project_code, client_id")
        .eq("is_archived", false)
        .order("project_code");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      title: string;
      projectId: string;
      designType: string;
      stage: string;
      scale: string;
      brief: string;
    }) => {
      const project = (projectsQuery.data ?? []).find((p) => p.id === form.projectId);
      if (!project) throw new Error("Pick the project this design belongs to.");
      if (!employee) throw new Error("Your employee record is missing.");
      const count = (query.data ?? []).length + 1;
      const { data, error } = await supabase
        .from("designs")
        .insert({
          company_id: employee.company_id,
          project_id: project.id,
          client_id: project.client_id,
          design_code: `DSG-${String(count).padStart(4, "0")}`,
          title: form.title,
          design_type: form.designType,
          stage: form.stage,
          scale: form.scale || null,
          brief: form.brief || null,
          designer_id: employee.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      await supabase.from("design_revisions").insert({
        design_id: data.id,
        revision_number: 1,
        change_summary: "Design created in Design Studio.",
        issued_by: employee.id,
      });
      return data;
    },
    onSuccess: () => {
      toast.success("Design created at revision 1");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["designs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (query.data ?? []).filter((d) => {
      const matchesStage = stage === "all" || d.stage === stage;
      const haystack =
        `${d.design_code} ${d.title} ${d.projects?.name ?? ""} ${d.clients?.name ?? ""}`.toLowerCase();
      return matchesStage && haystack.includes(t);
    });
  }, [query.data, term, stage]);

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const all = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Design Studio"
        description="Every site plan, elevation and plant schedule, linked to its project, client and revision trail."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New design</Button>
              </DialogTrigger>
              <NewDesignDialog
                projects={projectsQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(form) => create.mutate(form)}
              />
            </Dialog>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active designs" value={String(all.length)} />
        <StatCard
          label="In concept"
          value={String(all.filter((d) => d.stage === "concept").length)}
        />
        <StatCard
          label="Awaiting approval"
          value={String(all.filter((d) => d.approval_state === "pending_approval").length)}
          tone="warning"
        />
        <StatCard
          label="Approved for site"
          value={String(all.filter((d) => d.approval_state === "approved").length)}
          tone="success"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search design, project or client…"
          className="max-w-sm"
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>
                {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No designs yet"
          description="Create a design to start a site plan, elevation and plant schedule against a project."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((d) => (
            <Link
              key={d.id}
              to="/design/$designId"
              params={{ designId: d.id }}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.design_code} · Rev {d.current_revision} ·{" "}
                    {titleCase(d.design_type ?? "")}
                    {d.scale ? ` · ${d.scale}` : ""}
                  </p>
                </div>
                <StatusBadge value={d.approval_state} />
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Project</dt>
                  <dd className="font-medium">{d.projects?.name ?? "Unlinked"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Client</dt>
                  <dd className="font-medium">{d.clients?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Stage</dt>
                  <dd className="font-medium">{titleCase(d.stage ?? "")}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Designer</dt>
                  <dd className="font-medium">{d.employees?.full_name ?? "Unassigned"}</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs text-muted-foreground">
                Updated {shortDate(d.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function NewDesignDialog({
  projects,
  pending,
  onSubmit,
}: {
  projects: { id: string; name: string; project_code: string }[];
  pending: boolean;
  onSubmit: (form: {
    title: string;
    projectId: string;
    designType: string;
    stage: string;
    scale: string;
    brief: string;
  }) => void;
}) {
  const [title, setTitle] = useState("");
  const [projectId, setProjectId] = useState("");
  const [designType, setDesignType] = useState<string>("softscape");
  const [stage, setStage] = useState<string>("concept");
  const [scale, setScale] = useState("");
  const [brief, setBrief] = useState("");

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>New design</DialogTitle>
        <DialogDescription>
          A design always belongs to a project, so drawings, plant schedules and costs stay
          connected to the site.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="design-title">Title</Label>
          <Input
            id="design-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Central green concept masterplan"
          />
        </div>
        <div className="grid gap-2">
          <Label>Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.project_code} · {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="grid gap-2">
            <Label>Type</Label>
            <Select value={designType} onValueChange={setDesignType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DESIGN_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {titleCase(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Stage</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {titleCase(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="design-scale">Scale</Label>
            <Input
              id="design-scale"
              value={scale}
              onChange={(e) => setScale(e.target.value)}
              placeholder="1:200"
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="design-brief">Design brief</Label>
          <Textarea
            id="design-brief"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            rows={3}
            placeholder="What the client asked for and the site constraints that shape this design."
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !title.trim() || !projectId}
          onClick={() => onSubmit({ title: title.trim(), projectId, designType, stage, scale, brief })}
        >
          {pending ? "Creating…" : "Create design"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

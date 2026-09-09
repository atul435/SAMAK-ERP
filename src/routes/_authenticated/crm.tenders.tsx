import { useMemo, useRef, useState } from "react";
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
import { inr, shortDate, titleCase } from "@/lib/format";
import {
  daysToClose,
  matchKeyword,
  parseCsv,
  TENDER_KEYWORDS,
  TENDER_STATES,
  toIsoDate,
  toNumber,
  type TenderRow,
} from "@/lib/tenders";

export const Route = createFileRoute("/_authenticated/crm/tenders")({
  head: () => ({
    meta: [
      { title: "Upcoming Tenders — EnvironIQ" },
      {
        name: "description",
        content:
          "Government and private horticulture and landscaping tenders across India, matched by keyword with closing dates, values and bid status.",
      },
      { property: "og:title", content: "Upcoming Tenders — EnvironIQ" },
      {
        property: "og:description",
        content:
          "Track horticulture and landscaping tenders by closing date, value and bid decision.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TendersPage,
});

type NewTender = {
  tender_ref: string;
  organisation: string;
  title: string;
  description: string;
  keyword_matched: string;
  published_on: string;
  closing_on: string;
  estimated_value: string;
  location: string;
  state: string;
  source_name: string;
  source_url: string;
};

const emptyTender: NewTender = {
  tender_ref: "",
  organisation: "",
  title: "",
  description: "",
  keyword_matched: "",
  published_on: "",
  closing_on: "",
  estimated_value: "",
  location: "",
  state: "",
  source_name: "",
  source_url: "",
};

function TendersPage() {
  const qc = useQueryClient();
  const { employee, can } = useAuth();
  const canEdit = can("crm", "edit") || can("sales", "edit");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("all");
  const [keyword, setKeyword] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<NewTender>(emptyTender);
  const fileRef = useRef<HTMLInputElement>(null);

  const tendersQuery = useQuery({
    queryKey: ["tenders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select(
          "id, tender_ref, organisation, title, description, keyword_matched, published_on, closing_on, estimated_value, location, state, source_name, source_url, status, is_starred, notes, project_id, projects(project_code, name)",
        )
        .eq("is_archived", false)
        .order("closing_on", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as TenderRow[];
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["tender-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, project_code, name")
        .eq("is_archived", false)
        .order("project_code");
      if (error) throw error;
      return data as { id: string; project_code: string; name: string }[];
    },
  });

  const saveTender = useMutation({
    mutationFn: async (values: NewTender) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const payload = {
        company_id: employee.company_id,
        tender_ref: values.tender_ref.trim(),
        organisation: values.organisation.trim(),
        title: values.title.trim(),
        description: values.description.trim() || null,
        keyword_matched:
          values.keyword_matched ||
          matchKeyword(`${values.title} ${values.description}`) ||
          null,
        published_on: values.published_on || null,
        closing_on: values.closing_on || null,
        estimated_value: values.estimated_value ? Number(values.estimated_value) : null,
        location: values.location.trim() || null,
        state: values.state.trim() || null,
        source_name: values.source_name.trim() || null,
        source_url: values.source_url.trim() || null,
      };
      if (!payload.tender_ref || !payload.organisation || !payload.title) {
        throw new Error("Reference, authority and title are required.");
      }
      const { error } = await supabase.from("tenders").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tender added");
      setOpen(false);
      setForm(emptyTender);
      void qc.invalidateQueries({ queryKey: ["tenders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateTender = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("tenders")
        .update({ ...patch, reviewed_by: employee?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["tenders"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const importCsv = useMutation({
    mutationFn: async (file: File) => {
      if (!employee) throw new Error("Your employee record is missing.");
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error("That file has no tender rows.");
      const header = rows[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
      const col = (r: string[], name: string) => {
        const i = header.indexOf(name);
        return i === -1 ? "" : (r[i] ?? "").trim();
      };
      const existing = new Set(
        (tendersQuery.data ?? []).map((t) => t.tender_ref.trim().toLowerCase()),
      );
      const payload = rows
        .slice(1)
        .map((r) => ({
          company_id: employee.company_id,
          tender_ref: col(r, "tender_id") || col(r, "tender_ref") || col(r, "reference"),
          organisation: col(r, "organisation") || col(r, "organization") || col(r, "authority"),
          title: col(r, "title") || col(r, "description"),
          description: col(r, "description") || null,
          keyword_matched:
            col(r, "keyword_matched") ||
            matchKeyword(`${col(r, "title")} ${col(r, "description")}`),
          published_on: toIsoDate(col(r, "published_date") || col(r, "published_on")),
          closing_on: toIsoDate(col(r, "closing_date") || col(r, "closing_on")),
          estimated_value: toNumber(col(r, "tender_value") || col(r, "estimated_value")),
          location: col(r, "location") || null,
          state: col(r, "state") || null,
          source_name: col(r, "source_name") || null,
          source_url: col(r, "source_url") || col(r, "link") || null,
        }))
        .filter((t) => t.tender_ref && t.organisation && t.title)
        .filter((t) => !existing.has(t.tender_ref.toLowerCase()));
      if (payload.length === 0) throw new Error("No new tenders found in that file.");
      const { error } = await supabase.from("tenders").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} tender${count === 1 ? "" : "s"} imported`);
      void qc.invalidateQueries({ queryKey: ["tenders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const all = tendersQuery.data ?? [];

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return all.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (keyword !== "all" && (r.keyword_matched ?? "") !== keyword) return false;
      if (!t) return true;
      return [r.tender_ref, r.organisation, r.title, r.state, r.location]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(t));
    });
  }, [all, term, status, keyword]);

  const stats = useMemo(() => {
    const live = all.filter((r) => {
      const d = daysToClose(r.closing_on);
      return d === null || d >= 0;
    });
    const closingSoon = live.filter((r) => {
      const d = daysToClose(r.closing_on);
      return d !== null && d <= 7;
    });
    const value = live.reduce((sum, r) => sum + Number(r.estimated_value ?? 0), 0);
    const bidding = all.filter((r) => r.status === "bidding" || r.status === "submitted");
    return { live: live.length, closingSoon: closingSoon.length, value, bidding: bidding.length };
  }, [all]);

  if (tendersQuery.isLoading) return <LoadingState />;
  if (tendersQuery.error) return <ErrorState message={(tendersQuery.error as Error).message} />;

  return (
    <>
      <PageHeader
        title="Upcoming Tenders"
        description="Government and private tenders across India matched to our horticulture and landscaping keywords, with closing dates, values and bid decisions."
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importCsv.mutate(file);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                onClick={() => fileRef.current?.click()}
                disabled={importCsv.isPending}
              >
                {importCsv.isPending ? "Importing…" : "Import scraper CSV"}
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>Add tender</Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Add a tender</DialogTitle>
                    <DialogDescription>
                      Use this for a tender spotted manually; scraped tenders arrive through the
                      importer or the ingest endpoint.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Reference number" id="tender_ref">
                      <Input
                        id="tender_ref"
                        value={form.tender_ref}
                        onChange={(e) => setForm({ ...form, tender_ref: e.target.value })}
                      />
                    </Field>
                    <Field label="Issuing authority" id="organisation">
                      <Input
                        id="organisation"
                        value={form.organisation}
                        onChange={(e) => setForm({ ...form, organisation: e.target.value })}
                      />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Title" id="title">
                        <Input
                          id="title"
                          value={form.title}
                          onChange={(e) => setForm({ ...form, title: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="sm:col-span-2">
                      <Field label="Scope notes" id="description">
                        <Textarea
                          id="description"
                          rows={3}
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                        />
                      </Field>
                    </div>
                    <Field label="Keyword matched" id="keyword_matched">
                      <Select
                        {...(form.keyword_matched ? { value: form.keyword_matched } : {})}
                        onValueChange={(v) => setForm({ ...form, keyword_matched: v })}
                      >
                        <SelectTrigger id="keyword_matched">
                          <SelectValue placeholder="Detect from the title" />
                        </SelectTrigger>
                        <SelectContent>
                          {TENDER_KEYWORDS.map((k) => (
                            <SelectItem key={k} value={k}>
                              {titleCase(k)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label="Estimated value (₹)" id="estimated_value">
                      <Input
                        id="estimated_value"
                        type="number"
                        min="0"
                        value={form.estimated_value}
                        onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                      />
                    </Field>
                    <Field label="Published on" id="published_on">
                      <Input
                        id="published_on"
                        type="date"
                        value={form.published_on}
                        onChange={(e) => setForm({ ...form, published_on: e.target.value })}
                      />
                    </Field>
                    <Field label="Closing on" id="closing_on">
                      <Input
                        id="closing_on"
                        type="date"
                        value={form.closing_on}
                        onChange={(e) => setForm({ ...form, closing_on: e.target.value })}
                      />
                    </Field>
                    <Field label="City / location" id="location">
                      <Input
                        id="location"
                        value={form.location}
                        onChange={(e) => setForm({ ...form, location: e.target.value })}
                      />
                    </Field>
                    <Field label="State" id="state">
                      <Input
                        id="state"
                        value={form.state}
                        onChange={(e) => setForm({ ...form, state: e.target.value })}
                      />
                    </Field>
                    <Field label="Source portal" id="source_name">
                      <Input
                        id="source_name"
                        value={form.source_name}
                        onChange={(e) => setForm({ ...form, source_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Tender link" id="source_url">
                      <Input
                        id="source_url"
                        value={form.source_url}
                        onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                      />
                    </Field>
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => saveTender.mutate(form)}
                      disabled={saveTender.isPending}
                    >
                      Save tender
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ) : null
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live tenders" value={String(stats.live)} />
        <StatCard label="Closing within 7 days" value={String(stats.closingSoon)} tone="warning" />
        <StatCard label="Live tender value" value={inr(stats.value, true)} tone="success" />
        <StatCard label="Bidding or submitted" value={String(stats.bidding)} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search reference, authority, title, state…"
          className="max-w-sm"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every status</SelectItem>
            {TENDER_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={keyword} onValueChange={setKeyword}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Every keyword</SelectItem>
            {TENDER_KEYWORDS.map((k) => (
              <SelectItem key={k} value={k}>
                {titleCase(k)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="list" className="mt-4">
        <TabsList>
          <TabsTrigger value="list">Tender list</TabsTrigger>
          <TabsTrigger value="feed">Feed setup</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-3 pt-4">
          {rows.length === 0 ? (
            <EmptyState
              title="No tenders here yet"
              description="Import a scraper CSV, add one by hand, or point the Python scraper at the ingest endpoint under Feed setup."
            />
          ) : (
            rows.map((t) => {
              const left = daysToClose(t.closing_on);
              return (
                <div key={t.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display font-semibold">{t.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.organisation} · {t.tender_ref}
                        {t.state ? ` · ${t.state}` : ""}
                        {t.source_name ? ` · via ${t.source_name}` : ""}
                      </p>
                      {t.projects ? (
                        <Link
                          to="/projects/$projectId"
                          params={{ projectId: t.project_id! }}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                        >
                          Linked to {t.projects.project_code} · {t.projects.name}
                        </Link>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-numeric font-display text-lg font-semibold">
                        {t.estimated_value ? inr(t.estimated_value, true) : "Value not stated"}
                      </p>
                      <StatusBadge value={t.status} />
                    </div>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <Detail label="Published" value={shortDate(t.published_on)} />
                    <Detail
                      label="Closes"
                      value={
                        left === null
                          ? shortDate(t.closing_on)
                          : `${shortDate(t.closing_on)} · ${
                              left < 0 ? `${Math.abs(left)} days ago` : `${left} days left`
                            }`
                      }
                    />
                    <Detail
                      label="Keyword"
                      value={t.keyword_matched ? titleCase(t.keyword_matched) : "—"}
                    />
                    <Detail label="Location" value={t.location ?? "—"} />
                  </div>

                  {t.description ? (
                    <p className="mt-3 text-sm text-muted-foreground">{t.description}</p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {t.source_url ? (
                      <Button asChild size="sm" variant="outline">
                        <a href={t.source_url} target="_blank" rel="noreferrer noopener">
                          Open tender notice
                        </a>
                      </Button>
                    ) : null}
                    {canEdit ? (
                      <>
                        <Select
                          value={t.status}
                          onValueChange={(v) =>
                            updateTender.mutate({ id: t.id, patch: { status: v } })
                          }
                        >
                          <SelectTrigger className="h-9 w-40">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TENDER_STATES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {titleCase(s)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select
                          value={t.project_id ?? "none"}
                          onValueChange={(v) =>
                            updateTender.mutate({
                              id: t.id,
                              patch: { project_id: v === "none" ? null : v },
                            })
                          }
                        >
                          <SelectTrigger className="h-9 w-56">
                            <SelectValue placeholder="Link to project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No project linked</SelectItem>
                            {(projectsQuery.data ?? []).map((pr) => (
                              <SelectItem key={pr.id} value={pr.id}>
                                {pr.project_code} · {pr.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          variant={t.is_starred ? "default" : "outline"}
                          onClick={() =>
                            updateTender.mutate({
                              id: t.id,
                              patch: { is_starred: !t.is_starred },
                            })
                          }
                        >
                          {t.is_starred ? "Shortlisted" : "Shortlist"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            updateTender.mutate({ id: t.id, patch: { is_archived: true } })
                          }
                        >
                          Archive
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="feed" className="space-y-4 pt-4">
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-display font-semibold">How tenders arrive here</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5 text-muted-foreground">
              <li>
                Run the Python scraper on any machine or scheduler. It searches each portal for our
                keywords, cleans the dates and values, and writes a timestamped CSV.
              </li>
              <li>
                Either upload that CSV here with <strong>Import scraper CSV</strong>, or let the
                scraper post straight into this register.
              </li>
              <li>
                For direct posting it sends the rows to{" "}
                <span className="font-mono text-xs">/api/public/tenders-ingest</span> with the
                header <span className="font-mono text-xs">x-ingest-token</span>. The token is held
                in your project secrets as{" "}
                <span className="font-mono text-xs">TENDER_INGEST_TOKEN</span>; a tender already in
                the list is refreshed instead of duplicated.
              </li>
            </ol>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 text-sm">
            <p className="font-display font-semibold">Keywords being matched</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TENDER_KEYWORDS.map((k) => (
                <span
                  key={k}
                  className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                >
                  {titleCase(k)}
                </span>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  );
}

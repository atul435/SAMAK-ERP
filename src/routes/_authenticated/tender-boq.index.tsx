import { useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { shortDate } from "@/lib/format";
import { parseTenderBoqWorkbook, type ParsedTenderBoq } from "@/lib/tender-boq-import";

export const Route = createFileRoute("/_authenticated/tender-boq/")({
  head: () => ({
    meta: [
      { title: "Tender BOQ — EnvironIQ" },
      {
        name: "description",
        content:
          "Upload a client's tender rate schedule and fill in Samak's rates against its fixed quantities.",
      },
      { property: "og:title", content: "Tender BOQ — EnvironIQ" },
      {
        property: "og:description",
        content: "Client-issued tender BOQs, priced against fixed quantities.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenderBoqList,
});

function TenderBoqList() {
  const { employee, can } = useAuth();
  const canEdit = can("boq", "edit");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const query = useQuery({
    queryKey: ["tender-boqs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tender_boqs")
        .select(
          "id, project_name, status, updated_at, clients(name), tenders(title), tender_boq_items(id)",
        )
        .eq("is_archived", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const clientsQuery = useQuery({
    queryKey: ["clients-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const tendersQuery = useQuery({
    queryKey: ["tenders-lite"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenders")
        .select("id, title")
        .eq("is_archived", false)
        .order("title");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async (form: {
      parsed: ParsedTenderBoq;
      projectName: string;
      clientId: string;
      tenderId: string;
    }) => {
      if (!employee?.company_id)
        throw new Error("Your employee profile is not linked to a company.");
      const { data: boq, error } = await supabase
        .from("tender_boqs")
        .insert({
          company_id: employee.company_id,
          project_name: form.projectName.trim(),
          work_description: form.parsed.workDescription,
          client_id: form.clientId || null,
          tender_id: form.tenderId || null,
          prepared_by: employee.id,
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: itemsError } = await supabase.from("tender_boq_items").insert(
        form.parsed.items.map((item) => ({
          tender_boq_id: boq.id,
          item_code: item.itemCode,
          description: item.description,
          quantity: item.quantity,
          uom: item.uom,
          rate: item.rate,
          sort_order: item.sortOrder,
        })),
      );
      if (itemsError) throw itemsError;
      return boq.id;
    },
    onSuccess: () => {
      toast.success("Tender BOQ imported");
      setOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["tender-boqs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = query.data ?? [];

  return (
    <>
      <PageHeader
        title="Tender BOQ"
        description="Upload a client's tender rate schedule and fill in Samak's rates against its fixed quantities."
        actions={
          canEdit ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>Upload tender BOQ</Button>
              </DialogTrigger>
              <UploadTenderBoqDialog
                clients={clientsQuery.data ?? []}
                tenders={tendersQuery.data ?? []}
                pending={create.isPending}
                onSubmit={(form) => create.mutate(form)}
              />
            </Dialog>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No tender BOQs yet"
          description="Upload a client's rate schedule (an Excel file with Section, Item Description, Quantity, Unit, Rate and Amount columns) to start filling in rates."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {rows.map((b) => (
            <Link
              key={b.id}
              to="/tender-boq/$tenderBoqId"
              params={{ tenderBoqId: b.id }}
              className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 truncate font-display text-base font-semibold">
                  {b.project_name}
                </p>
                <StatusBadge value={b.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {(b.tender_boq_items ?? []).length} rows
                {b.clients ? ` · ${b.clients.name}` : ""}
                {b.tenders ? ` · ${b.tenders.title}` : ""}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Updated {shortDate(b.updated_at)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function UploadTenderBoqDialog({
  clients,
  tenders,
  pending,
  onSubmit,
}: {
  clients: { id: string; name: string }[];
  tenders: { id: string; title: string }[];
  pending: boolean;
  onSubmit: (form: {
    parsed: ParsedTenderBoq;
    projectName: string;
    clientId: string;
    tenderId: string;
  }) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedTenderBoq | null>(null);
  const [projectName, setProjectName] = useState("");
  const [clientId, setClientId] = useState("");
  const [tenderId, setTenderId] = useState("");

  const handleFile = async (file: File) => {
    setParsing(true);
    setParseError(null);
    setParsed(null);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseTenderBoqWorkbook(buffer);
      setParsed(result);
      setProjectName(result.projectName);
    } catch (e) {
      setParseError((e as Error).message);
    } finally {
      setParsing(false);
    }
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle>Upload tender BOQ</DialogTitle>
        <DialogDescription>
          Excel file with a header row containing Quantity and Rate columns — the typical format
          developers and main contractors issue with a tender. Quantities and units come from the
          file; you only fill in rates on the next screen.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="tender-file">Excel file (.xlsx)</Label>
          <Input
            id="tender-file"
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
        </div>

        {parsing ? <p className="text-sm text-muted-foreground">Reading file…</p> : null}
        {parseError ? <p className="text-sm text-destructive">{parseError}</p> : null}

        {parsed ? (
          <>
            <p className="text-sm text-muted-foreground">
              Found {parsed.items.length} rows (
              {parsed.items.filter((i) => i.quantity != null).length} fillable items).
            </p>
            <div className="grid gap-2">
              <Label htmlFor="tender-project-name">Project name</Label>
              <Input
                id="tender-project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Client (optional)</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Linked tender (optional)</Label>
              <Select value={tenderId} onValueChange={setTenderId}>
                <SelectTrigger>
                  <SelectValue placeholder="Not linked to a tracked tender" />
                </SelectTrigger>
                <SelectContent>
                  {tenders.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {parsed.workDescription ? (
              <div className="grid gap-2">
                <Label>Work description (from file)</Label>
                <Textarea value={parsed.workDescription} rows={2} disabled />
              </div>
            ) : null}
          </>
        ) : null}
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !parsed || !projectName.trim()}
          onClick={() => {
            if (!parsed) return;
            onSubmit({ parsed, projectName: projectName.trim(), clientId, tenderId });
          }}
        >
          {pending ? "Importing…" : "Import"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

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
import { inr, titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/masters/materials")({
  head: () => ({
    meta: [
      { title: "Materials master — EnvironIQ" },
      {
        name: "description",
        content:
          "Central material master with category, unit of measure, rate, GST and HSN for procurement, inventory and BOQ.",
      },
      { property: "og:title", content: "Materials master — EnvironIQ" },
      {
        property: "og:description",
        content: "Material master with UOM, rate, GST and HSN for procurement.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MaterialsPage,
});

type MaterialRow = {
  id: string;
  code: string;
  name: string;
  category: string;
  uom: string;
  standard_rate: number;
  hsn_code: string | null;
  gst_percent: number | null;
};

type MaterialForm = {
  name: string;
  category: string;
  uom: string;
  rate: string;
  gstPercent: string;
  hsnCode: string;
};

function MaterialsPage() {
  const { can } = useAuth();
  const canEdit = can("inventory", "edit");
  const queryClient = useQueryClient();
  const [term, setTerm] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialRow | null>(null);

  const query = useQuery({
    queryKey: ["materials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("materials")
        .select("id, code, name, category, uom, standard_rate, hsn_code, gst_percent")
        .order("name");
      if (error) throw error;
      return data as MaterialRow[];
    },
  });

  const create = useMutation({
    mutationFn: async (form: MaterialForm) => {
      if (!form.name.trim()) throw new Error("Material name is required.");
      if (!form.category.trim()) throw new Error("Category is required.");
      if (!form.uom.trim()) throw new Error("Unit of measure is required.");
      const { count } = await supabase
        .from("materials")
        .select("id", { count: "exact", head: true });
      const code = `MAT-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("materials").insert({
        code,
        name: form.name.trim(),
        category: form.category.trim(),
        uom: form.uom.trim(),
        standard_rate: form.rate.trim() ? Number(form.rate) : 0,
        gst_percent: form.gstPercent.trim() ? Number(form.gstPercent) : null,
        hsn_code: form.hsnCode.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material added");
      setCreateOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async (form: MaterialForm & { id: string }) => {
      const { error } = await supabase
        .from("materials")
        .update({
          name: form.name.trim(),
          category: form.category.trim(),
          uom: form.uom.trim(),
          standard_rate: form.rate.trim() ? Number(form.rate) : 0,
          gst_percent: form.gstPercent.trim() ? Number(form.gstPercent) : null,
          hsn_code: form.hsnCode.trim() || null,
        })
        .eq("id", form.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material updated");
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["materials"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((m) =>
    `${m.name} ${m.code} ${m.category ?? ""}`.toLowerCase().includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Materials master"
        description="Shared by BOQ, procurement, inventory and site issue — no duplicate masters."
        actions={
          canEdit ? (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button>Add material</Button>
              </DialogTrigger>
              <MaterialDialog
                title="Add material"
                pending={create.isPending}
                onSubmit={(form) => create.mutate(form)}
              />
            </Dialog>
          ) : null
        }
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search materials…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No materials match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Material</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">UOM</th>
                <th className="px-4 py-2 text-right font-medium">Rate</th>
                <th className="px-4 py-2 text-right font-medium">GST</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">HSN</th>
                {canEdit ? <th className="px-4 py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr
                  key={m.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/50"
                >
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {titleCase(m.category ?? "—")}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{m.uom}</td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {m.standard_rate ? inr(Number(m.standard_rate)) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric text-muted-foreground">
                    {m.gst_percent != null ? `${m.gst_percent}%` : "—"}
                  </td>
                  <td className="hidden px-4 py-2.5 font-mono text-xs text-muted-foreground lg:table-cell">
                    {m.hsn_code ?? "—"}
                  </td>
                  {canEdit ? (
                    <td className="px-4 py-2.5 text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>
                        Edit
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
          <MaterialDialog
            title="Edit material"
            initial={editing}
            pending={update.isPending}
            onSubmit={(form) => update.mutate({ ...form, id: editing.id })}
          />
        </Dialog>
      ) : null}
    </>
  );
}

function MaterialDialog({
  title,
  initial,
  pending,
  onSubmit,
}: {
  title: string;
  initial?: MaterialRow;
  pending: boolean;
  onSubmit: (form: MaterialForm) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [uom, setUom] = useState(initial?.uom ?? "");
  const [rate, setRate] = useState(String(initial?.standard_rate ?? ""));
  const [gstPercent, setGstPercent] = useState(String(initial?.gst_percent ?? ""));
  const [hsnCode, setHsnCode] = useState(initial?.hsn_code ?? "");

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          Shared across BOQ, procurement, inventory and site issue — one rate, one GST rate, no
          duplicates.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="mat-name">Material name</Label>
          <Input
            id="mat-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Kota stone, 25mm machine cut"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mat-category">Category</Label>
            <Input
              id="mat-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Hardscape, irrigation…"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mat-uom">Unit</Label>
            <Input
              id="mat-uom"
              value={uom}
              onChange={(e) => setUom(e.target.value)}
              placeholder="sqft"
            />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="mat-rate">Rate ₹</Label>
            <Input
              id="mat-rate"
              inputMode="decimal"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mat-gst">GST %</Label>
            <Input
              id="mat-gst"
              inputMode="decimal"
              value={gstPercent}
              onChange={(e) => setGstPercent(e.target.value)}
              placeholder="18"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="mat-hsn">HSN code</Label>
            <Input id="mat-hsn" value={hsnCode} onChange={(e) => setHsnCode(e.target.value)} />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={pending || !name.trim() || !category.trim() || !uom.trim()}
          onClick={() => onSubmit({ name, category, uom, rate, gstPercent, hsnCode })}
        >
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
import { useAuth } from "@/lib/auth-context";

const STAGES = ["new", "qualified", "proposal", "negotiation", "won", "lost"];

export const Route = createFileRoute("/_authenticated/crm/leads")({
  head: () => ({
    meta: [
      { title: "Leads — EnvironIQ CRM" },
      {
        name: "description",
        content:
          "Capture, score and progress landscape enquiries from first contact to won opportunity.",
      },
      { property: "og:title", content: "Leads — EnvironIQ CRM" },
      {
        property: "og:description",
        content: "Capture, score and progress landscape enquiries through the sales pipeline.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LeadsPage,
});

function LeadsPage() {
  const qc = useQueryClient();
  const { employee, can } = useAuth();
  const [term, setTerm] = useState("");
  const [stage, setStage] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    contact_name: "",
    contact_phone: "",
    contact_email: "",
    city: "",
    source: "referral",
    estimated_value: "",
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, lead_code, title, contact_name, contact_phone, city, source, stage, score, estimated_value, next_action, next_action_date, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createLead = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Lead title is required.");
      if (!employee?.company_id) throw new Error("Your employee profile is not linked to a company.");
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true });
      const code = `LEAD-${String((count ?? 0) + 1).padStart(4, "0")}`;
      const { error } = await supabase.from("leads").insert({
        company_id: employee.company_id,
        lead_code: code,
        title: form.title.trim(),
        contact_name: form.contact_name.trim() || null,
        contact_phone: form.contact_phone.trim() || null,
        contact_email: form.contact_email.trim() || null,
        city: form.city.trim() || null,
        source: form.source,
        next_action: form.notes.trim() || null,
        stage: "new",
        ...(form.estimated_value ? { estimated_value: Number(form.estimated_value) } : {}),
        owner_employee_id: employee.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpen(false);
      setFormError(null);
      setForm({
        title: "",
        contact_name: "",
        contact_phone: "",
        contact_email: "",
        city: "",
        source: "referral",
        estimated_value: "",
        notes: "",
      });
      void qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (e) => setFormError((e as Error).message),
  });

  const moveStage = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: string }) => {
      const { error } = await supabase.from("leads").update({ stage: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((l) => {
    const t = term.trim().toLowerCase();
    if (t && !`${l.title} ${l.lead_code} ${l.contact_name ?? ""}`.toLowerCase().includes(t))
      return false;
    if (stage !== "all" && l.stage !== stage) return false;
    return true;
  });

  const editable = can("crm", "edit");

  return (
    <>
      <PageHeader
        title="Leads"
        description="Every enquiry, scored and owned, feeding the Samak sales pipeline."
        actions={
          editable ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>New lead</Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Capture a new lead</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="title">Enquiry title *</Label>
                    <Input
                      id="title"
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Podium landscape — Kalyani Nagar"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="contact">Contact name</Label>
                      <Input
                        id="contact"
                        value={form.contact_name}
                        onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={form.contact_phone}
                        onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={form.contact_email}
                        onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="city">City</Label>
                      <Input
                        id="city"
                        value={form.city}
                        onChange={(e) => setForm({ ...form, city: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="source">Source</Label>
                      <Select
                        value={form.source}
                        onValueChange={(v) => setForm({ ...form, source: v })}
                      >
                        <SelectTrigger id="source">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["referral", "website", "architect", "tender", "repeat_client", "site_visit"].map(
                            (s) => (
                              <SelectItem key={s} value={s}>
                                {titleCase(s)}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="value">Estimated value (₹)</Label>
                      <Input
                        id="value"
                        type="number"
                        min="0"
                        value={form.estimated_value}
                        onChange={(e) => setForm({ ...form, estimated_value: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                  {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
                </div>
                <DialogFooter>
                  <Button
                    onClick={() => createLead.mutate()}
                    disabled={createLead.isPending || !form.title.trim()}
                  >
                    {createLead.isPending ? "Saving…" : "Save lead"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search leads…"
          className="max-w-xs"
        />
        <Select value={stage} onValueChange={setStage}>
          <SelectTrigger className="w-44">
            <SelectValue />
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
          title="No leads yet"
          description="Capture your first enquiry to start the pipeline."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Lead</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Contact</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Stage</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Next action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{l.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {l.lead_code} · {titleCase(l.source ?? "")} · {l.city ?? "—"}
                    </p>
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {l.contact_name ?? "—"}
                    <span className="block text-xs">{l.contact_phone ?? ""}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">
                    {l.estimated_value ? inr(Number(l.estimated_value), true) : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right text-numeric">{l.score ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {editable ? (
                      <Select
                        value={l.stage}
                        onValueChange={(v) => moveStage.mutate({ id: l.id, next: v })}
                      >
                        <SelectTrigger className="h-8 w-36">
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
                    ) : (
                      <StatusBadge value={l.stage} />
                    )}
                  </td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground lg:table-cell">
                    {l.next_action ?? "—"}
                    <span className="block text-xs">
                      {l.next_action_date ? shortDate(l.next_action_date) : ""}
                    </span>
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

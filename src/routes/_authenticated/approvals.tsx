import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inr, dateTime, titleCase } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

type ApprovalState =
  | "draft"
  | "submitted"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "executed"
  | "cancelled";

const STATES: ApprovalState[] = [
  "draft",
  "submitted",
  "pending_approval",
  "approved",
  "rejected",
  "executed",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval engine — EnvironIQ" },
      {
        name: "description",
        content:
          "Draft to executed approval workflow for purchase orders, BOQs, quotations, variations, payments and contracts.",
      },
      { property: "og:title", content: "Approval engine — EnvironIQ" },
      {
        property: "og:description",
        content: "Draft to executed approval workflow across every Samak Landscape module.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const qc = useQueryClient();
  const { employee, can } = useAuth();
  const [filter, setFilter] = useState<string>("open");
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const query = useQuery({
    queryKey: ["approvals", filter],
    queryFn: async () => {
      let q = supabase
        .from("approval_requests")
        .select(
          "id, request_code, entity_type, entity_label, summary, amount, state, created_at, decided_at, decision_note, ai_assisted, project_id",
        )
        .order("created_at", { ascending: false });
      if (filter === "open") q = q.in("state", ["draft", "submitted", "pending_approval"]);
      else if (filter !== "all") q = q.eq("state", filter as ApprovalState);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const historyQuery = useQuery({
    queryKey: ["approval-history", selected],
    enabled: Boolean(selected),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approval_actions")
        .select("id, from_state, to_state, actor_name, note, created_at")
        .eq("approval_request_id", selected!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const transition = useMutation({
    mutationFn: async ({
      id,
      from,
      to,
    }: {
      id: string;
      from: ApprovalState;
      to: ApprovalState;
    }) => {
      const patch: {
        state: ApprovalState;
        decided_at?: string;
        decision_note?: string | null;
        approver_id?: string | null;
      } = { state: to };
      if (to === "approved" || to === "rejected") {
        patch.decided_at = new Date().toISOString();
        patch.decision_note = note || null;
        patch.approver_id = employee?.id ?? null;
      }
      const { error } = await supabase.from("approval_requests").update(patch).eq("id", id);
      if (error) throw error;
      const { error: histErr } = await supabase.from("approval_actions").insert({
        approval_request_id: id,
        from_state: from,
        to_state: to,
        actor_name: employee?.full_name ?? "Unknown",
        note: note || null,
      });
      if (histErr) throw histErr;
    },
    onSuccess: () => {
      setNote("");
      void qc.invalidateQueries({ queryKey: ["approvals"] });
      void qc.invalidateQueries({ queryKey: ["approval-history"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((r) => {
    const t = term.trim().toLowerCase();
    if (!t) return true;
    return (
      r.entity_label.toLowerCase().includes(t) ||
      r.request_code.toLowerCase().includes(t) ||
      r.entity_type.toLowerCase().includes(t)
    );
  });

  const active = rows.find((r) => r.id === selected) ?? null;

  function nextStates(state: ApprovalState): ApprovalState[] {
    switch (state) {
      case "draft":
        return ["submitted", "cancelled"];
      case "submitted":
        return ["pending_approval", "cancelled"];
      case "pending_approval":
        return can("approvals", "approve") || employee ? ["approved", "rejected"] : [];
      case "approved":
        return ["executed"];
      default:
        return [];
    }
  }

  return (
    <>
      <PageHeader
        title="Approval engine"
        description="One workflow for purchase requisitions, purchase orders, BOQs, quotations, variations, payments, tenders, contracts, rate changes and HR actions."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search approvals…"
          className="max-w-xs"
        />
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open (draft → pending)</SelectItem>
            <SelectItem value="all">All states</SelectItem>
            {STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 overflow-hidden rounded-xl border border-border bg-card">
          {rows.length === 0 ? (
            <EmptyState
              title="No approvals in this view"
              description="Change the filter or clear your search."
            />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                <tr className="border-b border-border">
                  <th className="px-4 py-2 font-medium">Request</th>
                  <th className="px-4 py-2 font-medium">Type</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">State</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r.id)}
                    className={
                      "cursor-pointer border-b border-border last:border-0 hover:bg-secondary/60 " +
                      (selected === r.id ? "bg-secondary" : "")
                    }
                  >
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{r.entity_label}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.request_code} · {dateTime(r.created_at)}
                        {r.ai_assisted ? " · JARVIS assisted" : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{titleCase(r.entity_type)}</td>
                    <td className="px-4 py-2.5 text-right text-numeric">
                      {r.amount ? inr(Number(r.amount), true) : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge value={r.state} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <aside className="rounded-xl border border-border bg-card p-4">
          {!active ? (
            <p className="text-sm text-muted-foreground">
              Select a request to review its detail, history and available decisions.
            </p>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="font-display text-base font-semibold">{active.entity_label}</p>
                <p className="text-xs text-muted-foreground">
                  {active.request_code} · {titleCase(active.entity_type)}
                </p>
              </div>
              <StatusBadge value={active.state} />
              {active.summary ? <p className="text-sm">{active.summary}</p> : null}
              {active.amount ? (
                <p className="text-sm">
                  Value: <span className="text-numeric font-medium">{inr(Number(active.amount))}</span>
                </p>
              ) : null}

              <div>
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Approval history
                </p>
                <ol className="mt-2 space-y-2 border-l border-border pl-3">
                  {(historyQuery.data ?? []).map((h) => (
                    <li key={h.id} className="text-sm">
                      <span className="font-medium">
                        {titleCase(h.from_state ?? "—")} → {titleCase(h.to_state)}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {h.actor_name} · {dateTime(h.created_at)}
                      </span>
                      {h.note ? <span className="block text-xs">{h.note}</span> : null}
                    </li>
                  ))}
                  {(historyQuery.data ?? []).length === 0 ? (
                    <li className="text-xs text-muted-foreground">No transitions recorded yet.</li>
                  ) : null}
                </ol>
              </div>

              {nextStates(active.state as ApprovalState).length ? (
                <div className="space-y-2">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Decision note (recorded in the audit trail)"
                    rows={3}
                  />
                  <div className="flex flex-wrap gap-2">
                    {nextStates(active.state as ApprovalState).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === "rejected" || s === "cancelled" ? "outline" : "default"}
                        disabled={transition.isPending}
                        onClick={() =>
                          transition.mutate({
                            id: active.id,
                            from: active.state as ApprovalState,
                            to: s,
                          })
                        }
                      >
                        {titleCase(s)}
                      </Button>
                    ))}
                  </div>
                  {transition.isError ? (
                    <p className="text-sm text-destructive">
                      {(transition.error as Error).message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No further transitions available from this state.
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </>
  );
}

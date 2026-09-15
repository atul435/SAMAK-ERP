import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inr, shortDate } from "@/lib/format";
import { downloadTenderBoqWorkbook } from "@/lib/tender-boq-export";

export const Route = createFileRoute("/_authenticated/tender-boq/$tenderBoqId")({
  head: () => ({
    meta: [
      { title: "Tender BOQ — EnvironIQ" },
      {
        name: "description",
        content: "Fill in rates against a client's fixed tender quantities.",
      },
      { property: "og:title", content: "Tender BOQ — EnvironIQ" },
      { property: "og:description", content: "Rates filled against a client's tender quantities." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TenderBoqDetail,
});

function TenderBoqDetail() {
  const { tenderBoqId } = Route.useParams();
  const { can } = useAuth();
  const canEdit = can("boq", "edit");
  const queryClient = useQueryClient();
  const [rates, setRates] = useState<Record<string, string> | null>(null);
  const [exporting, setExporting] = useState(false);

  const query = useQuery({
    queryKey: ["tender-boq", tenderBoqId],
    queryFn: async () => {
      const [boq, items] = await Promise.all([
        supabase
          .from("tender_boqs")
          .select(
            "id, project_name, work_description, status, updated_at, clients(name), tenders(title)",
          )
          .eq("id", tenderBoqId)
          .single(),
        supabase
          .from("tender_boq_items")
          .select("id, item_code, description, quantity, uom, rate, sort_order")
          .eq("tender_boq_id", tenderBoqId)
          .order("sort_order"),
      ]);
      if (boq.error) throw boq.error;
      if (items.error) throw items.error;
      return { boq: boq.data, items: items.data ?? [] };
    },
  });

  useEffect(() => {
    if (query.data && rates === null) {
      setRates(
        Object.fromEntries(
          query.data.items.map((i) => [i.id, i.rate != null ? String(i.rate) : ""]),
        ),
      );
    }
  }, [query.data, rates]);

  const saveRate = useMutation({
    mutationFn: async ({ id, rate }: { id: string; rate: string }) => {
      const { error } = await supabase
        .from("tender_boq_items")
        .update({ rate: rate.trim() ? Number(rate) : null })
        .eq("id", id);
      if (error) throw error;
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("tender_boqs").update({ status }).eq("id", tenderBoqId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      void queryClient.invalidateQueries({ queryKey: ["tender-boq", tenderBoqId] });
      void queryClient.invalidateQueries({ queryKey: ["tender-boqs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = useMemo(() => {
    if (!query.data || !rates) return { grand: 0, bySection: new Map<string, number>() };
    const bySection = new Map<string, number>();
    let grand = 0;
    for (const item of query.data.items) {
      if (item.quantity == null) continue;
      const rate = Number(rates[item.id] || 0);
      const amount = item.quantity * rate;
      grand += amount;
      const section = item.item_code?.split(".")[0] ?? "—";
      bySection.set(section, (bySection.get(section) ?? 0) + amount);
    }
    return { grand, bySection };
  }, [query.data, rates]);

  if (query.isLoading || !rates) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;
  if (!query.data) return <ErrorState message="This tender BOQ could not be found." />;

  const { boq, items } = query.data;
  const sectionTitles = new Map(
    items
      .filter((i) => i.item_code && !i.item_code.includes("."))
      .map((i) => [i.item_code!, i.description]),
  );
  const filledCount = items.filter((i) => i.quantity != null && rates[i.id]?.trim()).length;
  const fillableCount = items.filter((i) => i.quantity != null).length;

  return (
    <>
      <PageHeader
        title={boq.project_name}
        description={`${items.length} rows · prepared for ${boq.clients?.name ?? boq.tenders?.title ?? "no linked client"} · updated ${shortDate(boq.updated_at)}`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge value={boq.status} />
            <Button
              variant="outline"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await downloadTenderBoqWorkbook(
                    {
                      projectName: boq.project_name,
                      workDescription: boq.work_description,
                      items: items.map((i) => ({
                        itemCode: i.item_code,
                        description: i.description,
                        quantity: i.quantity,
                        uom: i.uom,
                        rate: rates[i.id]?.trim() ? Number(rates[i.id]) : null,
                      })),
                    },
                    `${boq.project_name.replace(/[^a-z0-9]+/gi, "_")}.xlsx`,
                  );
                } finally {
                  setExporting(false);
                }
              }}
            >
              {exporting ? "Preparing…" : "Download filled BOQ"}
            </Button>
            {canEdit && boq.status === "draft" ? (
              <Button disabled={setStatus.isPending} onClick={() => setStatus.mutate("submitted")}>
                Mark submitted
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Fillable items"
          value={String(fillableCount)}
          hint={`${filledCount} priced`}
        />
        <StatCard label="Grand total" value={inr(totals.grand, true)} />
        <StatCard
          label="Sections priced"
          value={`${[...totals.bySection.values()].filter((v) => v > 0).length} / ${totals.bySection.size}`}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-3 py-2 font-medium">Code</th>
                <th className="px-3 py-2 font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Qty</th>
                <th className="px-3 py-2 font-medium">Unit</th>
                <th className="px-3 py-2 text-right font-medium">Rate ₹</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const isHeader = item.quantity == null;
                const depth = (item.item_code?.split(".").length ?? 1) - 1;
                const rate = Number(rates[item.id] || 0);
                const amount = isHeader ? 0 : (item.quantity ?? 0) * rate;
                return (
                  <tr
                    key={item.id}
                    className={
                      "border-b border-border/60 last:border-0" + (isHeader ? " bg-muted/40" : "")
                    }
                  >
                    <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                      {item.item_code}
                    </td>
                    <td
                      className={"px-3 py-2 align-top" + (isHeader ? " font-medium" : "")}
                      style={{ paddingLeft: `${12 + depth * 16}px` }}
                    >
                      {item.description}
                    </td>
                    <td className="px-3 py-2 text-right align-top text-numeric">
                      {isHeader ? "" : item.quantity!.toLocaleString("en-IN")}
                    </td>
                    <td className="px-3 py-2 align-top text-muted-foreground">{item.uom ?? ""}</td>
                    <td className="px-3 py-2 text-right align-top">
                      {isHeader ? null : (
                        <Input
                          inputMode="decimal"
                          value={rates[item.id] ?? ""}
                          disabled={!canEdit}
                          className="ml-auto w-28 text-right"
                          onChange={(e) =>
                            setRates((prev) => ({ ...(prev ?? {}), [item.id]: e.target.value }))
                          }
                          onBlur={(e) => saveRate.mutate({ id: item.id, rate: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top text-numeric font-medium">
                      {isHeader ? "" : inr(amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <aside className="h-fit space-y-3 rounded-xl border border-border bg-card p-4">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Section subtotals
          </p>
          <dl className="space-y-2 text-sm">
            {[...totals.bySection.entries()].map(([code, amount]) => (
              <div key={code} className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">
                  {code}
                  {sectionTitles.get(code) ? (
                    <span className="block text-xs">{sectionTitles.get(code)}</span>
                  ) : null}
                </dt>
                <dd className="shrink-0 text-numeric font-medium">{inr(amount)}</dd>
              </div>
            ))}
          </dl>
          <div className="flex items-center justify-between border-t border-border pt-2 text-sm font-semibold">
            <span>Grand total</span>
            <span className="text-numeric">{inr(totals.grand)}</span>
          </div>
        </aside>
      </div>
    </>
  );
}

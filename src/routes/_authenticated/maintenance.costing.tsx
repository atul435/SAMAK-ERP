import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { StatCard } from "@/components/common/StatCard";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { inr, pct } from "@/lib/format";
import { rowCosting, summariseCosting } from "@/lib/maintenance-costing";

export const Route = createFileRoute("/_authenticated/maintenance/costing")({
  head: () => ({
    meta: [
      { title: "Job Costing — EnvironIQ" },
      {
        name: "description",
        content:
          "Revenue, labour, material and equipment cost and margin for each maintenance contract.",
      },
      { property: "og:title", content: "Job Costing — EnvironIQ" },
      {
        property: "og:description",
        content: "Margin per contract, computed from real visit records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JobCostingPage,
});

const money = (n: number) => inr(n, true);

function JobCostingPage() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [overtimeDraft, setOvertimeDraft] = useState("2");
  const [hoursDraft, setHoursDraft] = useState("208");
  const [overtime, setOvertime] = useState(2);
  const [standardHours, setStandardHours] = useState(208);

  const query = useQuery({
    queryKey: ["maintenance-costing", month, overtime, standardHours],
    enabled: /^\d{4}-\d{2}$/.test(month),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("maintenance_contract_costing", {
        p_month_start: `${month}-01`,
        p_overtime_multiplier: overtime,
        p_standard_monthly_hours: standardHours,
      });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        revenue: Number(r.revenue),
        labour_hours: Number(r.labour_hours),
        labour_cost: r.labour_cost == null ? null : Number(r.labour_cost),
        material_cost: Number(r.material_cost),
        equipment_cost: Number(r.equipment_cost),
      }));
    },
  });

  const commitOvertime = () => {
    const n = Number(overtimeDraft);
    if (Number.isFinite(n) && n >= 1) setOvertime(n);
    else setOvertimeDraft(String(overtime));
  };
  const commitHours = () => {
    const n = Number(hoursDraft);
    if (Number.isFinite(n) && n > 0) setStandardHours(n);
    else setHoursDraft(String(standardHours));
  };

  const rows = query.data ?? [];
  const summary = summariseCosting(rows);

  return (
    <>
      <PageHeader
        title="Job Costing"
        description="Margin per contract, worked out from the visits scheduled in the month — real timesheets, material usage and equipment hours, not estimates."
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="grid gap-2">
          <Label htmlFor="cost-month">Month</Label>
          <Input
            id="cost-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-44"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cost-ot">Overtime pay multiplier</Label>
          <Input
            id="cost-ot"
            inputMode="decimal"
            value={overtimeDraft}
            onChange={(e) => setOvertimeDraft(e.target.value)}
            onBlur={commitOvertime}
            onKeyDown={(e) => e.key === "Enter" && commitOvertime()}
            className="w-40"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="cost-hours">Paid hours per month</Label>
          <Input
            id="cost-hours"
            inputMode="decimal"
            value={hoursDraft}
            onChange={(e) => setHoursDraft(e.target.value)}
            onBlur={commitHours}
            onKeyDown={(e) => e.key === "Enter" && commitHours()}
            className="w-40"
          />
        </div>
      </div>

      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState message={(query.error as Error).message} /> : null}

      {query.data ? (
        rows.length === 0 ? (
          <EmptyState
            title="No contracts to cost for this month"
            description="Costing covers active contracts and any contract with visits scheduled in the month."
          />
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Revenue" value={money(summary.revenue)} />
              <StatCard label="Total cost" value={money(summary.totalCost)} />
              <StatCard
                label="Margin"
                value={money(summary.margin)}
                tone={summary.margin < 0 ? "danger" : "success"}
              />
              <StatCard
                label="Margin %"
                value={summary.marginPct == null ? "—" : pct(summary.marginPct)}
                tone={summary.marginPct != null && summary.marginPct < 0 ? "danger" : "default"}
                {...(summary.withheldCount > 0
                  ? {
                      hint: `${summary.withheldCount} contract${summary.withheldCount === 1 ? "" : "s"} left out — labour withheld`,
                    }
                  : {})}
              />
            </div>

            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 font-medium">Contract</th>
                    <th className="px-4 py-2 text-right font-medium">Visits</th>
                    <th className="px-4 py-2 text-right font-medium">Hours</th>
                    <th className="px-4 py-2 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2 text-right font-medium">Labour</th>
                    <th className="px-4 py-2 text-right font-medium">Material</th>
                    <th className="px-4 py-2 text-right font-medium">Equipment</th>
                    <th className="px-4 py-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const c = rowCosting(r);
                    return (
                      <tr key={r.contract_id} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{r.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {r.contract_code} · {r.client_name}
                          </p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric text-muted-foreground">
                          {r.visit_count}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric text-muted-foreground">
                          {r.labour_hours}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">{money(r.revenue)}</td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {r.labour_withheld ? (
                            <span
                              className="text-muted-foreground"
                              title="Only one person's hours — showing it would reveal their pay"
                            >
                              Withheld
                            </span>
                          ) : (
                            money(r.labour_cost ?? 0)
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {money(r.material_cost)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-numeric">
                          {money(r.equipment_cost)}
                        </td>
                        <td
                          className={
                            "px-4 py-2.5 text-right text-numeric " +
                            (c.margin != null && c.margin < 0 ? "text-destructive" : "")
                          }
                        >
                          {c.margin == null ? (
                            "—"
                          ) : (
                            <>
                              {money(c.margin)}
                              {c.marginPct != null ? (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({pct(c.marginPct)})
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="space-y-1 rounded-xl border border-dashed border-border p-4 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">How these numbers are built</p>
              <p>
                Only visits scheduled in the month count, and only cost recorded against a visit —
                timesheet hours not linked to a visit can't be assigned to a contract and are left
                out. Revenue is the contract's monthly fee for active contracts.
              </p>
              <p>
                Labour is timesheet hours at each person's pay ÷ the paid hours above; overtime
                hours are paid at the multiplier. Pay is confidential, so a contract whose labour is
                one person's hours shows "Withheld" and is left out of the totals.
              </p>
              <p>
                Material uses the logged unit cost, or the catalogue rate if none was entered.
                Equipment cost is zero until the equipment has a running cost per hour.
              </p>
            </div>
          </>
        )
      ) : null}
    </>
  );
}

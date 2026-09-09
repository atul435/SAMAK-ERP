import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Sparkles, Send, ShieldAlert, RefreshCw, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  askJarvis,
  jarvisBriefing,
  jarvisDecisions,
  type JarvisAnswer,
  type JarvisBriefing,
  type JarvisBriefingItem,
} from "@/lib/jarvis.functions";
import type { JarvisDecision } from "@/lib/jarvis-decisions";
import { dateTime, inr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jarvis/")({
  head: () => ({
    meta: [
      { title: "JARVIS intelligence — EnvironIQ" },
      {
        name: "description",
        content:
          "Ask JARVIS about live projects, cash, procurement and site progress. Answers are grounded in your own ERP records and never execute sensitive actions.",
      },
      { property: "og:title", content: "JARVIS intelligence — EnvironIQ" },
      {
        property: "og:description",
        content: "Role-aware answers and a daily executive briefing grounded in live ERP records.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JarvisPage,
});

const PROMPTS = [
  "What requires my attention today?",
  "Which projects are burning more cost than billed?",
  "How much money is overdue from clients?",
  "Which purchase orders are late on delivery?",
  "Where is site progress behind the estimate?",
  "Which nursery batches are losing plants?",
];

const SEVERITY_CLASS: Record<JarvisBriefingItem["severity"], string> = {
  high: "border-destructive/40 bg-destructive/5",
  medium: "border-warning/40 bg-warning/5",
  low: "border-border bg-card",
};

function BriefingList({ title, items }: { title: string; items: JarvisBriefingItem[] }) {
  if (!items.length) return null;
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={cn("rounded-xl border p-3", SEVERITY_CLASS[item.severity])}>
            <p className="text-sm font-medium">{item.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {item.sources.map((s) => (
                <span
                  key={s}
                  className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                >
                  {s}
                </span>
              ))}
              {item.link ? (
                <Link to={item.link} className="text-xs font-medium underline underline-offset-2">
                  Open
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DecisionCard({ decision }: { decision: JarvisDecision }) {
  return (
    <article className={cn("rounded-xl border p-4", SEVERITY_CLASS[decision.severity])}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{decision.title}</h3>
        <span className="text-numeric text-sm">{inr(decision.amount)}</span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{decision.detail}</p>
      <p className="mt-2 text-sm">
        <span className="font-medium">Suggested: </span>
        {decision.suggestion}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {decision.sources.map((code) => (
          <span
            key={code}
            className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
          >
            {code}
          </span>
        ))}
        <span className="flex-1" />
        {decision.links.map((link) => (
          <Button key={link.label} asChild size="sm" variant="outline">
            <Link
              to={link.to as never}
              {...(link.params ? { params: link.params as never } : {})}
            >
              {link.label}
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        ))}
      </div>
    </article>
  );
}

function JarvisPage() {
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: JarvisAnswer }>>([]);
  const ask = useServerFn(askJarvis);
  const brief = useServerFn(jarvisBriefing);

  const briefing = useMutation<JarvisBriefing>({ mutationFn: () => brief() });
  const decide = useServerFn(jarvisDecisions);
  const decisions = useQuery({ queryKey: ["jarvis", "decisions"], queryFn: () => decide() });
  const collections = (decisions.data?.decisions ?? []).filter((d) => d.kind === "collection");
  const deliveries = (decisions.data?.decisions ?? []).filter((d) => d.kind === "delivery");

  const chat = useMutation({
    mutationFn: (q: string) =>
      ask({
        data: {
          question: q,
          page: "/jarvis",
          history: history
            .slice(0, 3)
            .reverse()
            .map((h) => ({ question: h.q, answer: h.a.answer })),
        },
      }),
    onSuccess: (answer, q) => setHistory((h) => [{ q, a: answer }, ...h]),
  });

  function submit(q: string) {
    const value = q.trim();
    if (!value || chat.isPending) return;
    setQuestion("");
    chat.mutate(value);
  }

  return (
    <>
      <PageHeader
        title="JARVIS intelligence"
        description="Every answer is drawn from ERP records you are permitted to see. JARVIS analyses and recommends; sensitive actions always need authorised human approval."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(question);
            }}
          >
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask about projects, cash, procurement, site progress…"
              aria-label="Ask JARVIS"
            />
            <Button type="submit" size="icon" disabled={chat.isPending} aria-label="Send">
              <Send className="h-4 w-4" />
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => submit(p)}
                className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
              >
                {p}
              </button>
            ))}
          </div>

          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Decisions JARVIS suggests
              </h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => decisions.refetch()}
                disabled={decisions.isFetching}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", decisions.isFetching && "animate-spin")} />
                Refresh
              </Button>
            </div>

            {decisions.isPending ? (
              <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
                Reading collections and deliveries…
              </p>
            ) : null}

            {decisions.isError ? (
              <p className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                {(decisions.error as Error).message}
              </p>
            ) : null}

            {decisions.data && !decisions.data.decisions.length ? (
              <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                Nothing overdue and nothing late — no decisions needed right now.
              </p>
            ) : null}

            {collections.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Money to collect</p>
                {collections.map((d) => (
                  <DecisionCard key={d.id} decision={d} />
                ))}
              </div>
            ) : null}

            {deliveries.length ? (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Deliveries to chase</p>
                {deliveries.map((d) => (
                  <DecisionCard key={d.id} decision={d} />
                ))}
              </div>
            ) : null}
          </section>

          {chat.isPending ? (
            <div className="rounded-xl border border-border p-4 text-sm text-muted-foreground">
              Analysing live ERP data…
            </div>
          ) : null}

          {chat.isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {(chat.error as Error).message}
            </div>
          ) : null}

          {history.length === 0 && !chat.isPending ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Ask a question, or generate today's briefing on the right. JARVIS reads live projects,
              estimates, site diaries, purchase orders, stock, invoices, receipts and payroll — and
              cites the record codes behind every statement.
            </div>
          ) : null}

          {history.map((entry, i) => (
            <article key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
              <p className="text-sm font-medium">{entry.q}</p>
              <p className="text-sm leading-relaxed">{entry.a.answer}</p>

              {entry.a.evidence.length ? (
                <div>
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Evidence
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted-foreground">
                    {entry.a.evidence.map((e, j) => (
                      <li key={j}>{e}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {entry.a.sources.length ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Source records:</span>
                  {entry.a.sources.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Confidence</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      entry.a.confidence > 0.7 ? "bg-success" : "bg-warning",
                    )}
                    style={{ width: `${Math.round(entry.a.confidence * 100)}%` }}
                  />
                </div>
                <span className="text-xs text-numeric">
                  {Math.round(entry.a.confidence * 100)}%
                </span>
              </div>

              <div className="rounded-lg bg-secondary p-3">
                <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Recommended action
                </p>
                <p className="mt-1 text-sm">{entry.a.recommendedAction}</p>
                {entry.a.requiresApproval ? (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-warning-foreground">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Sensitive action — requires authorised human approval.
                  </p>
                ) : null}
                {entry.a.actionLink ? (
                  <Button asChild size="sm" className="mt-3">
                    <Link to={entry.a.actionLink}>Open</Link>
                  </Button>
                ) : null}
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4" /> Daily briefing
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => briefing.mutate()}
                disabled={briefing.isPending}
              >
                <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", briefing.isPending && "animate-spin")} />
                {briefing.data ? "Refresh" : "Generate"}
              </Button>
            </div>

            {briefing.isError ? (
              <p className="mt-3 text-sm text-destructive">{(briefing.error as Error).message}</p>
            ) : null}

            {briefing.data ? (
              <>
                <p className="mt-3 text-sm leading-relaxed">{briefing.data.headline}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generated {dateTime(briefing.data.generatedAt)}
                </p>
              </>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                A role-aware summary of what needs deciding, what is at risk and where revenue is
                available — built from today's live records.
              </p>
            )}
          </div>

          {briefing.data ? (
            <div className="space-y-4">
              <BriefingList title="Needs a decision" items={briefing.data.priorities} />
              <BriefingList title="Risks" items={briefing.data.risks} />
              <BriefingList title="Opportunities" items={briefing.data.opportunities} />
            </div>
          ) : null}

          <Link
            to="/jarvis/log"
            className="block rounded-xl border border-border p-3 text-sm hover:bg-secondary"
          >
            View the AI task log →
          </Link>
        </aside>
      </div>
    </>
  );
}

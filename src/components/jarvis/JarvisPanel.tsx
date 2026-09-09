import { useState } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { Sparkles, X, Send, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askJarvis, type JarvisAnswer } from "@/lib/jarvis.functions";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What requires my attention today?",
  "Which projects are at risk?",
  "Which leads should sales call first?",
  "What are the biggest risks to this month's margin?",
  "Which approvals are waiting on me?",
];

export function JarvisPanel() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Array<{ q: string; a: JarvisAnswer }>>([]);
  const { employee, company, roles } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const ask = useServerFn(askJarvis);

  const mutation = useMutation({
    mutationFn: (q: string) =>
      ask({
        data: {
          question: q,
          page: pathname,
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
    if (!value || mutation.isPending) return;
    setQuestion("");
    mutation.mutate(value);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 flex items-center gap-2 rounded-full surface-canopy px-4 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105 md:right-6 md:bottom-6"
        aria-label="Open JARVIS assistant"
      >
        <Sparkles className="h-4 w-4" />
        JARVIS
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/30 backdrop-blur-sm">
          <aside className="flex h-full w-full max-w-lg flex-col border-l border-border bg-card shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-border p-4">
              <div>
                <p className="font-display text-lg font-semibold">JARVIS</p>
                <p className="text-xs text-muted-foreground">
                  {employee?.full_name ?? "Signed-in user"} · {roles.join(", ") || "no role"} ·{" "}
                  {company?.name ?? "—"} · {pathname}
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </header>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {history.length === 0 && !mutation.isPending ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    JARVIS answers only from ERP records you are permitted to see, and never
                    executes sensitive actions on its own.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => submit(s)}
                        className="rounded-full border border-border px-3 py-1.5 text-xs hover:bg-secondary"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {mutation.isPending ? (
                <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
                  Analysing live ERP data…
                </div>
              ) : null}

              {mutation.isError ? (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {(mutation.error as Error).message}
                </div>
              ) : null}

              {history.map((entry, i) => (
                <article key={i} className="space-y-3 rounded-xl border border-border p-4">
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
                        <Link to={entry.a.actionLink} onClick={() => setOpen(false)}>
                          Open
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>

            <form
              className="flex items-center gap-2 border-t border-border p-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit(question);
              }}
            >
              <Input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask JARVIS about your projects, cash, leads…"
                aria-label="Ask JARVIS"
              />
              <Button type="submit" size="icon" disabled={mutation.isPending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}

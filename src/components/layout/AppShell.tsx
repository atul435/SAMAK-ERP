import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Menu, Search, X, LogOut, Leaf } from "lucide-react";
import { NAVIGATION } from "@/lib/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "@/components/layout/GlobalSearch";
import { GrowIQPanel } from "@/components/growiq/GrowIQPanel";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

export function AppShell({ children }: { children: ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const { employee, company, roles, can, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("is_read", false)
      .then(({ count }) => setUnread(count ?? 0));
  }, [pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const groups = NAVIGATION.map((g) => ({
    ...g,
    items: g.items.filter((i) => i.module === "dashboard" || can(i.module, "view")),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-4 py-5">
          <Link to="/dashboard" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <Leaf className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-display text-base leading-tight font-semibold">
                EnvironIQ
              </span>
              <span className="block text-[11px] text-sidebar-foreground/60">
                {company?.name ?? "Samak Landscape"}
              </span>
            </span>
          </Link>
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setNavOpen(false)}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="space-y-5 px-3 pb-24">
          {groups.map((group) => (
            <div key={group.group}>
              <p className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-sidebar-foreground/45 uppercase">
                {group.group}
              </p>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    {item.future ? (
                      <span
                        className="flex cursor-not-allowed items-center justify-between rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/40"
                        title="Specified in the blueprint — planned module"
                      >
                        {item.label}
                        <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[9px] tracking-wide uppercase">
                          Planned
                        </span>
                      </span>
                    ) : (
                      <Link
                        to={item.to}
                        className="block rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-sidebar-accent"
                        activeProps={{
                          className:
                            "bg-sidebar-accent text-sidebar-accent-foreground font-medium block rounded-md px-2 py-1.5 text-sm",
                        }}
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      {navOpen ? (
        <div
          className="fixed inset-0 z-30 bg-foreground/40 lg:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            className="lg:hidden"
            onClick={() => setNavOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-muted-foreground hover:bg-secondary"
          >
            <Search className="h-4 w-4" />
            <span className="truncate">Search projects, clients, leads, documents…</span>
            <kbd className="ml-auto hidden rounded border border-border px-1.5 text-[10px] sm:inline">
              ⌘K
            </kbd>
          </button>

          <Link
            to="/notifications"
            className="relative rounded-lg p-2 hover:bg-secondary"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
                {unread}
              </span>
            ) : null}
          </Link>

          <div className="hidden text-right sm:block">
            <p className="text-sm leading-tight font-medium">{employee?.full_name ?? "—"}</p>
            <p className="text-[11px] text-muted-foreground">
              {employee?.designation ?? titleCase(roles[0] ?? "")}
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        <main className="flex-1 space-y-6 p-4 pb-24 sm:p-6">{children}</main>
      </div>

      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <GrowIQPanel />
    </div>
  );
}

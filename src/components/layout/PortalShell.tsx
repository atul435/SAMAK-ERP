import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Leaf, LogOut, Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { usePortalUser } from "@/lib/portal-context";
import { CLIENT_PORTAL_NAV, VENDOR_PORTAL_NAV } from "@/lib/portal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PortalShell({ children }: { children: ReactNode }) {
  const portal = usePortalUser();
  const [open, setOpen] = useState(false);
  const nav = portal.portal_type === "client" ? CLIENT_PORTAL_NAV : VENDOR_PORTAL_NAV;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/portal" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Leaf className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-display text-base leading-tight font-semibold">
                Samak {portal.portal_type === "client" ? "Client" : "Partner"} Portal
              </span>
              <span className="block text-[11px] text-muted-foreground">{portal.full_name}</span>
            </span>
          </Link>

          <nav className="ml-6 hidden items-center gap-1 sm:flex">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                activeOptions={{ exact: item.to === "/portal" }}
                activeProps={{
                  className:
                    "rounded-md px-3 py-1.5 text-sm bg-secondary text-foreground font-medium",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="sm:hidden"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle navigation"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Sign out"
              onClick={() => void supabase.auth.signOut()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <nav className={cn("border-t border-border px-4 pb-3 sm:hidden", open ? "block" : "hidden")}>
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2 text-sm text-muted-foreground hover:bg-secondary"
              activeOptions={{ exact: item.to === "/portal" }}
              activeProps={{
                className: "block rounded-md px-2 py-2 text-sm bg-secondary font-medium",
              }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 p-4 pb-20 sm:p-6">{children}</main>

      <footer className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        Samak Landscape · Design · Build · Maintain
      </footer>
    </div>
  );
}

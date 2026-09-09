import { createContext, useContext, type ReactNode } from "react";
import type { PortalUser } from "@/lib/portal";

const PortalContext = createContext<PortalUser | null>(null);

export function PortalProvider({
  value,
  children,
}: {
  value: PortalUser;
  children: ReactNode;
}) {
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortalUser(): PortalUser {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortalUser must be used inside PortalProvider");
  return ctx;
}

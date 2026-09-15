import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PortalUser = Database["public"]["Tables"]["portal_users"]["Row"];

/** Portal identity of the signed-in user, or null when they are staff. */
export async function fetchPortalUser(): Promise<PortalUser | null> {
  const { data } = await supabase
    .from("portal_users")
    .select("*")
    .eq("is_active", true)
    .maybeSingle();
  return data ?? null;
}

/** Where a signed-in user belongs after authentication. */
export async function resolveLanding(): Promise<"/portal" | "/dashboard"> {
  const portal = await fetchPortalUser();
  return portal ? "/portal" : "/dashboard";
}

export const CLIENT_PORTAL_NAV = [
  { label: "Overview", to: "/portal" },
  { label: "Projects", to: "/portal/projects" },
  { label: "Maintenance", to: "/portal/maintenance" },
  { label: "Invoices & receipts", to: "/portal/billing" },
] as const;

export const VENDOR_PORTAL_NAV = [
  { label: "Overview", to: "/portal" },
  { label: "Purchase orders", to: "/portal/orders" },
  { label: "Bills & receipts", to: "/portal/bills" },
] as const;

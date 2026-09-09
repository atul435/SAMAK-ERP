import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { fetchPortalUser } from "@/lib/portal";
import { PortalProvider } from "@/lib/portal-context";
import { PortalShell } from "@/components/layout/PortalShell";
import { ErrorState } from "@/components/common/EmptyState";

export const Route = createFileRoute("/_portal")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const portal = await fetchPortalUser();
    if (!portal) throw redirect({ to: "/dashboard" });
    return { portal };
  },
  component: PortalLayout,
  errorComponent: () => <ErrorState message="This portal page could not be loaded." />,
  notFoundComponent: () => <ErrorState message="That portal page does not exist." />,
});

function PortalLayout() {
  const { portal } = Route.useRouteContext();
  return (
    <PortalProvider value={portal}>
      <PortalShell>
        <Outlet />
      </PortalShell>
    </PortalProvider>
  );
}

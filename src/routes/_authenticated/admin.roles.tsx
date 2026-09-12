import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { ErrorState, LoadingState } from "@/components/common/EmptyState";
import { moduleLabel, titleCase } from "@/lib/format";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/_authenticated/admin/roles")({
  head: () => ({
    meta: [
      { title: "Roles & permissions — EnvironIQ admin" },
      {
        name: "description",
        content:
          "Role-based access matrix governing every ERP module — and the same model GrowIQ operates under.",
      },
      { property: "og:title", content: "Roles & permissions — EnvironIQ admin" },
      {
        property: "og:description",
        content: "The role-based access matrix that also governs the GrowIQ intelligence layer.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RolesPage,
});

function RolesPage() {
  const { roles } = useAuth();
  const query = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("id, role, module, action")
        .order("role");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const grouped = new Map<string, Map<string, string[]>>();
  for (const p of query.data ?? []) {
    if (!grouped.has(p.role)) grouped.set(p.role, new Map());
    const mods = grouped.get(p.role)!;
    mods.set(p.module, [...(mods.get(p.module) ?? []), p.action]);
  }

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Access is granted by role and scoped to your company and projects. GrowIQ reads under exactly the same rules and can never bypass them."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {[...grouped.entries()].map(([role, modules]) => (
          <section
            key={role}
            className={
              "rounded-xl border bg-card p-4 " +
              ((roles as string[]).includes(role) ? "border-primary" : "border-border")
            }
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-semibold">{titleCase(role)}</h2>
              {(roles as string[]).includes(role) ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium tracking-wide text-primary-foreground uppercase">
                  Your role
                </span>
              ) : null}
            </div>
            <ul className="mt-3 space-y-1.5">
              {[...modules.entries()].map(([mod, actions]) => (
                <li key={mod} className="flex items-start justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">{moduleLabel(mod)}</span>
                  <span className="text-right text-xs">
                    {[...new Set(actions)].map((a) => titleCase(a)).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}

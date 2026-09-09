import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "@/components/common/EmptyState";
import { Input } from "@/components/ui/input";
import { titleCase } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/employees")({
  head: () => ({
    meta: [
      { title: "Employees — EnvironIQ admin" },
      {
        name: "description",
        content: "Company, department and reporting structure for the Samak Landscape workforce.",
      },
      { property: "og:title", content: "Employees — EnvironIQ admin" },
      {
        property: "og:description",
        content: "Company, department and reporting structure for the workforce.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: EmployeesPage,
});

function EmployeesPage() {
  const [term, setTerm] = useState("");
  const query = useQuery({
    queryKey: ["employees-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_code, full_name, email, phone, designation, primary_role, is_active, departments!employees_department_id_fkey(name, code)",
        )
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  if (query.isLoading) return <LoadingState />;
  if (query.isError) return <ErrorState message={(query.error as Error).message} />;

  const rows = (query.data ?? []).filter((e) =>
    `${e.full_name} ${e.employee_code} ${e.designation ?? ""}`
      .toLowerCase()
      .includes(term.trim().toLowerCase()),
  );

  return (
    <>
      <PageHeader
        title="Employees"
        description="The people master behind project teams, approvals and site operations."
      />
      <Input
        value={term}
        onChange={(e) => setTerm(e.target.value)}
        placeholder="Search employees…"
        className="max-w-xs"
      />
      {rows.length === 0 ? (
        <EmptyState title="No employees match" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-xs tracking-wide text-muted-foreground uppercase">
              <tr className="border-b border-border">
                <th className="px-4 py-2 font-medium">Employee</th>
                <th className="px-4 py-2 font-medium">Department</th>
                <th className="hidden px-4 py-2 font-medium md:table-cell">Designation</th>
                <th className="px-4 py-2 font-medium">Role</th>
                <th className="hidden px-4 py-2 font-medium lg:table-cell">Contact</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/50">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{e.full_name}</p>
                    <p className="text-xs text-muted-foreground">{e.employee_code}</p>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.departments?.name ?? "—"}</td>
                  <td className="hidden px-4 py-2.5 text-muted-foreground md:table-cell">
                    {e.designation ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">{titleCase(e.primary_role ?? "—")}</td>
                  <td className="hidden px-4 py-2.5 text-xs text-muted-foreground lg:table-cell">
                    {e.email}
                    <span className="block">{e.phone}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

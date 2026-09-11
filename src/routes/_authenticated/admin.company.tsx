import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { Database } from "@/integrations/supabase/types";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Company = Database["public"]["Tables"]["companies"]["Row"];

export const Route = createFileRoute("/_authenticated/admin/company")({
  head: () => ({
    meta: [
      { title: "Company settings — EnvironIQ admin" },
      {
        name: "description",
        content: "Legal name, GSTIN and registered address used across invoices, POs and reports.",
      },
      { property: "og:title", content: "Company settings — EnvironIQ admin" },
      {
        property: "og:description",
        content: "The company record every invoice, PO and report is issued under.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompanySettingsPage,
});

function CompanySettingsPage() {
  const { company, can, refresh } = useAuth();
  const canEdit = can("admin", "edit");

  if (!company) return <LoadingState />;

  return (
    <>
      <PageHeader
        title="Company settings"
        description="This is the one company record the ERP runs under — its name, GSTIN and address appear on every invoice, purchase order and report."
      />
      <CompanyForm key={company.updated_at} company={company} canEdit={canEdit} onSaved={refresh} />
    </>
  );
}

function CompanyForm({
  company,
  canEdit,
  onSaved,
}: {
  company: Company;
  canEdit: boolean;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(company.name);
  const [legalName, setLegalName] = useState(company.legal_name ?? "");
  const [gstin, setGstin] = useState(company.gstin ?? "");
  const [city, setCity] = useState(company.city ?? "");
  const [state, setState] = useState(company.state ?? "");
  const [country, setCountry] = useState(company.country ?? "India");
  const [currency, setCurrency] = useState(company.currency ?? "INR");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("companies")
        .update({
          name: name.trim(),
          legal_name: legalName.trim() || null,
          gstin: gstin.trim() || null,
          city: city.trim() || null,
          state: state.trim() || null,
          country: country.trim() || null,
          currency: currency.trim() || "INR",
        })
        .eq("id", company.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Company details updated");
      await onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl rounded-xl border border-border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-sm font-semibold">Registered details</h2>
        <span className="text-xs text-muted-foreground">Company code: {company.code}</span>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="co-name">Trading name</Label>
          <Input
            id="co-name"
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="co-legal-name">Legal name</Label>
          <Input
            id="co-legal-name"
            value={legalName}
            disabled={!canEdit}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="As registered with the Registrar of Companies"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="co-gstin">GSTIN</Label>
          <Input
            id="co-gstin"
            value={gstin}
            disabled={!canEdit}
            onChange={(e) => setGstin(e.target.value.toUpperCase())}
            placeholder="27AABCS1429B1ZX"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="co-currency">Currency</Label>
          <Input
            id="co-currency"
            value={currency}
            disabled={!canEdit}
            onChange={(e) => setCurrency(e.target.value.toUpperCase())}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="co-city">City</Label>
          <Input
            id="co-city"
            value={city}
            disabled={!canEdit}
            onChange={(e) => setCity(e.target.value)}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="co-state">State</Label>
          <Input
            id="co-state"
            value={state}
            disabled={!canEdit}
            onChange={(e) => setState(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:col-span-2">
          <Label htmlFor="co-country">Country</Label>
          <Input
            id="co-country"
            value={country}
            disabled={!canEdit}
            onChange={(e) => setCountry(e.target.value)}
          />
        </div>
      </div>
      {canEdit ? (
        <div className="mt-5 flex justify-end">
          <Button disabled={save.isPending || !name.trim()} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : (
        <p className="mt-5 text-xs text-muted-foreground">
          Only the Managing Director, CEO or CTO can edit company details.
        </p>
      )}
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY_NAME, COMPANY_ID } from "@/lib/company";
import { VENDOR_CATEGORIES } from "@/lib/procurement";
import { titleCase } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/vendor-register")({
  head: () => ({
    meta: [
      { title: "Supplier registration — Samak Landscape" },
      {
        name: "description",
        content:
          "Register as a supplier of plants, soil media, irrigation, hardscape or tools to Samak Landscape Pvt. Ltd. Share your GST, PAN, contact and bank details for onboarding.",
      },
      { property: "og:title", content: "Supplier registration — Samak Landscape" },
      {
        property: "og:description",
        content: "Apply to supply plants, manure, irrigation, hardscape or tools to our landscape projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VendorRegisterPage,
});

const registrationSchema = z.object({
  business_name: z.string().trim().min(2, "Enter your registered business name").max(160),
  category: z.string().trim().min(1),
  gstin: z
    .string()
    .trim()
    .max(15)
    .regex(/^[0-9A-Z]{15}$/, "GST number must be 15 characters")
    .optional()
    .or(z.literal("")),
  pan: z
    .string()
    .trim()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "PAN must look like AAACS1305F")
    .optional()
    .or(z.literal("")),
  contact_name: z.string().trim().min(2, "Enter the contact person's name").max(120),
  email: z.string().trim().email("Enter a valid email address").max(255),
  phone: z.string().trim().min(8, "Enter a reachable phone number").max(20),
  address: z.string().trim().max(300).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  state: z.string().trim().max(80).optional().or(z.literal("")),
  bank_name: z.string().trim().max(120).optional().or(z.literal("")),
  account_number: z.string().trim().max(30).optional().or(z.literal("")),
  ifsc: z
    .string()
    .trim()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "IFSC must look like HDFC0001234")
    .optional()
    .or(z.literal("")),
  payment_terms: z.string().trim().max(120).optional().or(z.literal("")),
  supplies: z.string().trim().min(3, "Tell us what you supply").max(600),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
});

type RegistrationForm = z.infer<typeof registrationSchema>;

const emptyForm: RegistrationForm = {
  business_name: "",
  category: "plants",
  gstin: "",
  pan: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  bank_name: "",
  account_number: "",
  ifsc: "",
  payment_terms: "",
  supplies: "",
  notes: "",
};

function VendorRegisterPage() {
  const [form, setForm] = useState<RegistrationForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);

  const set = (key: keyof RegistrationForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = useMutation({
    mutationFn: async (values: RegistrationForm) => {
      const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);
      const { error } = await supabase.from("vendor_registrations").insert({
        company_id: COMPANY_ID,
        business_name: values.business_name.trim(),
        category: values.category,
        gstin: clean(values.gstin)?.toUpperCase() ?? null,
        pan: clean(values.pan)?.toUpperCase() ?? null,
        contact_name: values.contact_name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        address: clean(values.address),
        city: clean(values.city),
        state: clean(values.state),
        bank_name: clean(values.bank_name),
        account_number: clean(values.account_number),
        ifsc: clean(values.ifsc)?.toUpperCase() ?? null,
        payment_terms: clean(values.payment_terms),
        supplies: values.supplies.trim(),
        notes: clean(values.notes),
        review_state: "submitted" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDone(true);
      setForm(emptyForm);
      toast.success("Registration submitted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onSubmit = () => {
    const parsed = registrationSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !next[key]) next[key] = issue.message;
      }
      setErrors(next);
      toast.error("Please correct the highlighted fields");
      return;
    }
    setErrors({});
    submit.mutate(parsed.data);
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:py-14">
      <header className="space-y-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {COMPANY_NAME}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Supplier registration</h1>
        <p className="text-sm text-muted-foreground">
          Share your business, tax and bank details once. Our procurement team reviews every
          registration before you are added to the approved supplier list and can receive purchase
          orders.
        </p>
      </header>

      {done ? (
        <section className="mt-8 rounded-xl border border-border bg-card p-6">
          <h2 className="text-lg font-semibold">Thank you — we have your details</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Our procurement team will verify your GST and bank details and get in touch on the
            contact number you shared. Approved suppliers receive a portal login to track purchase
            orders and payments.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="outline" onClick={() => setDone(false)}>
              Register another business
            </Button>
            <Button asChild>
              <Link to="/">Back to home</Link>
            </Button>
          </div>
        </section>
      ) : (
        <form
          className="mt-8 space-y-8"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <Section title="Business details">
            <Field
              id="business_name"
              label="Registered business name"
              value={form.business_name}
              onChange={set("business_name")}
              error={errors["business_name"]}
              className="sm:col-span-2"
              placeholder="Green Nursery"
            />
            <div className="grid gap-2">
              <Label>What do you mainly supply?</Label>
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENDOR_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {titleCase(c.replace("_", " "))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field
              id="payment_terms"
              label="Preferred payment terms"
              value={form.payment_terms ?? ""}
              onChange={set("payment_terms")}
              error={errors["payment_terms"]}
              placeholder="30 days from delivery"
            />
            <Field
              id="gstin"
              label="GST number"
              value={form.gstin ?? ""}
              onChange={set("gstin")}
              error={errors["gstin"]}
              placeholder="06AAKFG7781H1ZB"
            />
            <Field
              id="pan"
              label="PAN"
              value={form.pan ?? ""}
              onChange={set("pan")}
              error={errors["pan"]}
              placeholder="AAKFG7781H"
            />
          </Section>

          <Section title="Contact">
            <Field
              id="contact_name"
              label="Contact person"
              value={form.contact_name}
              onChange={set("contact_name")}
              error={errors["contact_name"]}
            />
            <Field
              id="phone"
              label="Phone"
              value={form.phone}
              onChange={set("phone")}
              error={errors["phone"]}
              placeholder="+91 98110 44521"
            />
            <Field
              id="email"
              label="Email"
              type="email"
              value={form.email}
              onChange={set("email")}
              error={errors["email"]}
              className="sm:col-span-2"
            />
            <Field
              id="address"
              label="Address"
              value={form.address ?? ""}
              onChange={set("address")}
              error={errors["address"]}
              className="sm:col-span-2"
            />
            <Field
              id="city"
              label="City"
              value={form.city ?? ""}
              onChange={set("city")}
              error={errors["city"]}
            />
            <Field
              id="state"
              label="State"
              value={form.state ?? ""}
              onChange={set("state")}
              error={errors["state"]}
            />
          </Section>

          <Section title="Bank details for payments">
            <Field
              id="bank_name"
              label="Bank name and branch"
              value={form.bank_name ?? ""}
              onChange={set("bank_name")}
              error={errors["bank_name"]}
              className="sm:col-span-2"
            />
            <Field
              id="account_number"
              label="Account number"
              value={form.account_number ?? ""}
              onChange={set("account_number")}
              error={errors["account_number"]}
            />
            <Field
              id="ifsc"
              label="IFSC"
              value={form.ifsc ?? ""}
              onChange={set("ifsc")}
              error={errors["ifsc"]}
              placeholder="HDFC0001234"
            />
          </Section>

          <Section title="What you can supply">
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="supplies">Items, sizes and typical capacity</Label>
              <Textarea
                id="supplies"
                rows={4}
                value={form.supplies}
                onChange={(e) => set("supplies")(e.target.value)}
                placeholder="Avenue trees 2.5-3 m, flowering shrubs, Zoysia and Bermuda turf. Capacity 5,000 plants a month."
              />
              {errors["supplies"] ? (
                <p className="text-xs text-destructive">{errors["supplies"]}</p>
              ) : null}
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="notes">Anything else we should know</Label>
              <Textarea
                id="notes"
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => set("notes")(e.target.value)}
                placeholder="Past landscape projects, certifications, delivery radius."
              />
            </div>
          </Section>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submit.isPending}>
              {submit.isPending ? "Submitting…" : "Submit registration"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Your details are shared only with our procurement team.
            </p>
          </div>
        </form>
      )}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

import type { AppRole } from "@/lib/auth-context";

export interface RoleProfile {
  role: AppRole;
  display: string;
  level: string;
  notes: string;
}

/** Role hierarchy shown on the user-management console. */
export const ROLE_PROFILES: RoleProfile[] = [
  { role: "md", display: "Managing Director", level: "Full system access", notes: "Sees every module, approves anything, manages all users." },
  { role: "ceo", display: "Chief Executive", level: "Full system access", notes: "Company-wide visibility and final financial approval." },
  { role: "cto", display: "Chief Technology Officer", level: "Full system access", notes: "Owns the platform, roles and JARVIS configuration." },
  { role: "sales_director", display: "Sales Director", level: "Business development", notes: "All leads, opportunities and tenders. No payroll." },
  { role: "bd_manager", display: "BD Manager", level: "Lead and tender management", notes: "Own pipeline; cannot approve estimates." },
  { role: "design_head", display: "Design Head", level: "Design and estimation", notes: "Approves designs and BOQs." },
  { role: "designer", display: "Designer", level: "Design only", notes: "Creates designs and plant palettes; cannot approve." },
  { role: "project_manager", display: "Project Manager", level: "Project delivery", notes: "Own projects, site days, procurement requests." },
  { role: "site_engineer", display: "Site Engineer", level: "Field operations", notes: "Daily progress, labour, materials on assigned projects." },
  { role: "site_supervisor", display: "Site Supervisor", level: "Field operations", notes: "Records work done and attendance only." },
  { role: "horticulture_head", display: "Horticulture Head", level: "Plants and aftercare", notes: "Nursery, PlantIQ, health checks and survival." },
  { role: "procurement_manager", display: "Procurement Manager", level: "Buying and vendors", notes: "Purchase orders, vendors, supplier bills." },
  { role: "store_manager", display: "Store Manager", level: "Stores and stock", notes: "Receipts, issues and stock on hand." },
  { role: "finance", display: "Finance", level: "Money in and out", notes: "Invoices, payments, expenses, payroll runs." },
  { role: "hr", display: "Human Resources", level: "People", notes: "Employees, leave, compensation." },
  { role: "client", display: "Client / Partner", level: "Portal only", notes: "Cannot open the ERP. Sees their own portal records." },
];

export const PERMISSION_MODULES = [
  "dashboard",
  "crm",
  "design",
  "boq",
  "projects",
  "site_ops",
  "procurement",
  "inventory",
  "nursery",
  "plantiq",
  "care",
  "finance",
  "hr",
  "documents",
  "jarvis",
  "admin",
] as const;

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "reject",
  "export",
  "financial_approval",
  "ai_recommend",
  "ai_execute",
] as const;

export function roleDisplay(role: string): string {
  return ROLE_PROFILES.find((r) => r.role === role)?.display ?? role.replace(/_/g, " ");
}

/** Simple strength hint for the temporary password an admin sets. */
export function passwordIssue(value: string): string | null {
  if (value.length < 8) return "Use at least 8 characters.";
  if (!/[A-Za-z]/.test(value) || !/[0-9]/.test(value)) return "Mix letters and numbers.";
  return null;
}

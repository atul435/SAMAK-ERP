export interface NavItem {
  label: string;
  to: string;
  module: string;
  future?: boolean;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

/**
 * Full navigation architecture from the Samak blueprint.
 * Items marked `future` are retained in the architecture and shown as
 * planned so no specified capability is lost.
 */
export const NAVIGATION: NavGroup[] = [
  {
    group: "JARVIS",
    items: [
      { label: "Command Centre", to: "/dashboard", module: "dashboard" },
      { label: "JARVIS", to: "/jarvis", module: "jarvis" },
      { label: "Approvals", to: "/approvals", module: "dashboard" },
      { label: "Notifications", to: "/notifications", module: "dashboard" },
      { label: "AI Task Log", to: "/jarvis/log", module: "jarvis" },
    ],
  },
  {
    group: "Business",
    items: [
      { label: "Leads", to: "/crm/leads", module: "crm" },
      { label: "Clients", to: "/crm/clients", module: "crm" },
      { label: "Opportunities", to: "/crm/opportunities", module: "crm" },
      { label: "Upcoming Tenders", to: "/crm/tenders", module: "crm" },
    ],
  },
  {
    group: "Design & Estimation",
    items: [
      { label: "Design Studio", to: "/design", module: "design" },
      { label: "Plant Palette", to: "/masters/plants", module: "plantiq" },
      { label: "BOQ & Estimation", to: "/boq", module: "boq" },
    ],
  },
  {
    group: "Projects",
    items: [
      { label: "Project Control", to: "/projects", module: "projects" },
      { label: "Site Operations", to: "/site", module: "site_ops" },
      { label: "Quality & Safety", to: "/projects/quality", module: "projects", future: true },
    ],
  },
  {
    group: "Supply Chain",
    items: [
      { label: "Materials Master", to: "/masters/materials", module: "inventory" },
      { label: "Procurement", to: "/procurement", module: "procurement" },
      { label: "Inventory & Stores", to: "/inventory", module: "inventory" },
    ],
  },
  {
    group: "Horticulture",
    items: [
      { label: "PlantIQ", to: "/plantiq", module: "plantiq" },
      { label: "Nursery Stock", to: "/nursery", module: "nursery" },
      { label: "Samak Care / AMC", to: "/care", module: "care", future: true },
    ],
  },
  {
    group: "Finance & People",
    items: [
      { label: "Finance", to: "/finance", module: "finance" },
      { label: "People", to: "/hr", module: "hr" },
    ],
  },
  {
    group: "Knowledge",
    items: [{ label: "Documents", to: "/documents", module: "documents" }],
  },
  {
    group: "Admin",
    items: [
      { label: "User Management", to: "/admin/users", module: "admin" },
      { label: "Employees", to: "/admin/employees", module: "admin" },
      { label: "Portal Accounts", to: "/admin/portal", module: "crm" },
      { label: "Roles & Permissions", to: "/admin/roles", module: "admin" },
      { label: "Audit Log", to: "/admin/audit", module: "admin" },
    ],
  },
];

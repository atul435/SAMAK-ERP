import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Employee = Database["public"]["Tables"]["employees"]["Row"];
type Company = Database["public"]["Tables"]["companies"]["Row"];
export type AppRole = Database["public"]["Enums"]["app_role"];

export interface Permission {
  module: string;
  action: string;
}

interface AuthState {
  session: Session | null;
  employee: Employee | null;
  company: Company | null;
  roles: AppRole[];
  permissions: Permission[];
  loading: boolean;
  refresh: () => Promise<void>;
  can: (module: string, action: string) => boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadProfile() {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    const { data: emp } = uid
      ? await supabase.from("employees").select("*").eq("user_id", uid).maybeSingle()
      : { data: null };
    setEmployee(emp ?? null);

    if (emp?.company_id) {
      const { data: comp } = await supabase
        .from("companies")
        .select("*")
        .eq("id", emp.company_id)
        .maybeSingle();
      setCompany(comp ?? null);
    }
    const { data: roleRows } = await supabase.from("user_roles").select("role");
    const roleList = (roleRows ?? []).map((r) => r.role as AppRole);
    setRoles(roleList);
    if (roleList.length) {
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("module, action")
        .in("role", roleList);
      setPermissions(perms ?? []);
    } else {
      setPermissions([]);
    }
  }

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setEmployee(null);
      setCompany(null);
      setRoles([]);
      setPermissions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    loadProfile().finally(() => setLoading(false));
  }, [session?.user.id]);

  const value: AuthState = {
    session,
    employee,
    company,
    roles,
    permissions,
    loading,
    refresh: loadProfile,
    can: (module, action) =>
      permissions.some((p) => p.module === module && p.action === action),
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

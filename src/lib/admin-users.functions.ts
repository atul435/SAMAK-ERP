import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface StaffAccountAuthInfo {
  userId: string;
  email: string | null;
  lastSignInAt: string | null;
  createdAt: string | null;
  emailConfirmed: boolean;
  blocked: boolean;
}

async function assertAdmin(supabase: { rpc: (fn: "is_admin") => Promise<{ data: unknown; error: unknown }> }) {
  const { data, error } = await supabase.rpc("is_admin");
  if (error || data !== true) {
    throw new Error("Only an administrator can manage user accounts.");
  }
}

/** Auth-side facts (last sign-in, blocked, confirmed) for every login. */
export const listAccountAuthInfo = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StaffAccountAuthInfo[]> => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw error;
    return data.users.map((u) => ({
      userId: u.id,
      email: u.email ?? null,
      lastSignInAt: u.last_sign_in_at ?? null,
      createdAt: u.created_at ?? null,
      emailConfirmed: Boolean(u.email_confirmed_at),
      blocked: Boolean(
        (u as { banned_until?: string | null }).banned_until &&
          new Date((u as { banned_until?: string }).banned_until!).getTime() > Date.now(),
      ),
    }));
  });

const createSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(72),
  role: z.string().min(2).max(40),
  employeeCode: z.string().min(1).max(40),
  designation: z.string().max(120).optional(),
  departmentId: z.string().uuid().optional(),
  phone: z.string().max(30).optional(),
});

/** Creates the login, the employee record and the role grant in one step. */
export const createStaffAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createSchema.parse(data))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as never);

    const { data: me, error: meError } = await context.supabase
      .from("employees")
      .select("company_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (meError) throw meError;
    const companyId = me?.company_id;
    if (!companyId) throw new Error("Your own employee record has no company.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const created = await supabaseAdmin.auth.admin.createUser({
      email: data.email.trim().toLowerCase(),
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
    });
    if (created.error) throw created.error;
    const userId = created.data.user.id;

    const employee = await supabaseAdmin.from("employees").insert({
      company_id: companyId,
      user_id: userId,
      employee_code: data.employeeCode,
      full_name: data.fullName,
      email: data.email.trim().toLowerCase(),
      phone: data.phone ?? null,
      designation: data.designation ?? null,
      primary_role: data.role as never,
      department_id: data.departmentId ?? null,
      is_active: true,
    });
    if (employee.error) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw employee.error;
    }

    const roleGrant = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role as never, company_id: companyId });
    if (roleGrant.error) throw roleGrant.error;

    return { userId };
  });

/** Sets a new password for an existing login. */
export const resetAccountPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(8).max(72) }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as never);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.password,
    });
    if (error) throw error;
    return { ok: true };
  });

/** Blocks or restores a login. A blocked account cannot sign in at all. */
export const setAccountBlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ userId: z.string().uuid(), blocked: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase as never);
    if (data.userId === context.userId) throw new Error("You cannot block your own account.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      ban_duration: data.blocked ? "876000h" : "none",
    } as never);
    if (error) throw error;
    await supabaseAdmin.from("employees").update({ is_active: !data.blocked }).eq("user_id", data.userId);
    return { ok: true };
  });

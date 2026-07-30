import { supabase } from "./supabase";

export type AdminRole = "super_admin" | "admin" | "employee";

export type AdminProfile = {
  id: string;
  email: string;
  full_name: string;
  role: AdminRole;
  is_active: boolean;
};

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("admin_profiles")
    .select("id, email, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data || !data.is_active) return null;

  return data as AdminProfile;
}

export function canManageUsers(role?: AdminRole | null) {
  return role === "super_admin";
}

export function canDelete(role?: AdminRole | null) {
  return role === "super_admin" || role === "admin";
}

export function canEdit(role?: AdminRole | null) {
  return role === "super_admin" || role === "admin";
}

export function canCreate(role?: AdminRole | null) {
  return role === "super_admin" || role === "admin" || role === "employee";
}

export function canViewReports(role?: AdminRole | null) {
  return role === "super_admin" || role === "admin";
}

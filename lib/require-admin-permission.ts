import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import {
  canAccess,
  isAdminRole,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-permissions";

type ProfileRow = {
  role: string;
  is_active: boolean;
};

export async function requireAdminPermission(
  permission: AdminPermission
): Promise<{
  userId: string;
  email: string;
  role: AdminRole;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/admin-login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error) {
    console.error("تعذر تحميل صلاحية المستخدم:", error);
    redirect("/admin-access-denied?reason=profile-error");
  }

  if (!profile || !profile.is_active) {
    redirect("/admin-access-denied?reason=inactive");
  }

  if (!isAdminRole(profile.role)) {
    redirect("/admin-access-denied?reason=invalid-role");
  }

  const allowed = canAccess(profile.role, permission);

  

  if (!allowed) {
    redirect(
      `/admin-access-denied?reason=permission&permission=${encodeURIComponent(
        permission
      )}`
    );
  }

  return {
    userId: user.id,
    email: user.email || "",
    role: profile.role,
  };
}
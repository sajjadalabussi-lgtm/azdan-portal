import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase-server";
import {
  isAdminRole,
  type AdminRole,
} from "@/lib/admin-permissions";

import AdminSessionBar from "./admin-session-bar";
import AdminRoleProvider from "./role-provider";

type ProfileRow = {
  role: string;
  is_active: boolean;
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

    redirect(
      "/admin-access-denied?reason=profile-error"
    );
  }

  if (!profile || !profile.is_active) {
    redirect("/admin-access-denied?reason=inactive");
  }

  if (!isAdminRole(profile.role)) {
    redirect(
      "/admin-access-denied?reason=invalid-role"
    );
  }

  const role: AdminRole = profile.role;

  return (
    <AdminRoleProvider role={role}>
      {children}

      <AdminSessionBar
        email={user.email || "مستخدم الإدارة"}
        role={role}
      />
    </AdminRoleProvider>
  );
}
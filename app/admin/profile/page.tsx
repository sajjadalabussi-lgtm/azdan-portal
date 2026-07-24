import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { isAdminRole } from "@/lib/admin-permissions";
import ProfileForm from "./profile-form";

type ProfileRow = {
  full_name: string | null;
  role: string;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/admin-login");

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, role, is_active, created_at, updated_at")
    .eq("id", user.id)
    .maybeSingle<ProfileRow>();

  if (error || !profile || !profile.is_active || !isAdminRole(profile.role)) {
    redirect("/admin-access-denied?reason=profile-error");
  }

  return (
    <ProfileForm
      userId={user.id}
      email={user.email || ""}
      initialFullName={profile.full_name || ""}
      role={profile.role}
      createdAt={profile.created_at}
      lastSignInAt={user.last_sign_in_at || null}
    />
  );
}

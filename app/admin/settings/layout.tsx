import { requireAdminPermission } from "@/lib/require-admin-permission";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPermission("manage_users");
  return children;
}

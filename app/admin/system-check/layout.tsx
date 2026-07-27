import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function SystemCheckLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPermission("view_settings");
  return <>{children}</>;
}

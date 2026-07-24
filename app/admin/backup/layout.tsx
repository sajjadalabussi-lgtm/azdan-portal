import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function BackupLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPermission("manage_users");
  return <>{children}</>;
}

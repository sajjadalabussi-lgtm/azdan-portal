import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function PermissionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPermission("manage_finance");

  return <>{children}</>;
}

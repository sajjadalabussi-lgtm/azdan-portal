import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function ExecutiveDashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPermission("view_reports");
  return <>{children}</>;
}

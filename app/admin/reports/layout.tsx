import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function ReportsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPermission("view_reports");
  return <>{children}</>;
}

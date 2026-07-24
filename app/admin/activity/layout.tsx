import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function ActivityLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPermission("view_activity");
  return children;
}

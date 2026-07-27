import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function ProjectCommentsLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requireAdminPermission("view_clients");
  return <>{children}</>;
}

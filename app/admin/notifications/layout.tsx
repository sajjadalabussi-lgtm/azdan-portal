import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function NotificationsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireAdminPermission("manage_notifications");

  return <>{children}</>;
}

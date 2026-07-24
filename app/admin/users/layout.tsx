import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function UsersLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPermission("manage_users");

  return <>{children}</>;
}
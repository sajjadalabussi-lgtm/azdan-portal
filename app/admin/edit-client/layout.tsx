import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/require-admin-permission";

export const dynamic = "force-dynamic";

export default async function EditClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPermission("manage_clients");

  return <>{children}</>;
}
import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/require-admin-permission";

export const dynamic = "force-dynamic";

export default async function EditUpdateLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPermission("manage_updates");

  return <>{children}</>;
}
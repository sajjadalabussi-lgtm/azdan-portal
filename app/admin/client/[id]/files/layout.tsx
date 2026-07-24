import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/require-admin-permission";

export const dynamic = "force-dynamic";

export default async function PaymentsLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPermission("manage_finance");

  return <>{children}</>;
}
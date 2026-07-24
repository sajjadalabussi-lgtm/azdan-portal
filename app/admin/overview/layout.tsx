import type { ReactNode } from "react";
import { requireAdminPermission } from "@/lib/require-admin-permission";

export default async function OverviewLayout({ children }: { children: ReactNode }) {
  await requireAdminPermission("view_clients");
  return children;
}

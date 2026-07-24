import type { ReactNode } from "react";
import AdminRoleProvider from "./role-provider";

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <AdminRoleProvider>{children}</AdminRoleProvider>;
}
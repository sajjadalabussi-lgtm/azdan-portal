"use client";

import type { ReactNode } from "react";

import type { AdminPermission } from "@/lib/admin-permissions";
import { useAdminRole } from "./role-provider";

export default function Permission({
  permission,
  children,
  fallback = null,
}: {
  permission: AdminPermission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasPermission } = useAdminRole();

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
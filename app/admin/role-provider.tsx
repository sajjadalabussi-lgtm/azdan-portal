"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import {
  canAccess,
  type AdminPermission,
  type AdminRole,
} from "@/lib/admin-permissions";

type AdminRoleContextValue = {
  role: AdminRole;
  hasPermission: (permission: AdminPermission) => boolean;
};

const AdminRoleContext =
  createContext<AdminRoleContextValue | null>(null);

export default function AdminRoleProvider({
  role,
  children,
}: {
  role: AdminRole;
  children: ReactNode;
}) {
  function hasPermission(permission: AdminPermission) {
    return canAccess(role, permission);
  }

  return (
    <AdminRoleContext.Provider
      value={{
        role,
        hasPermission,
      }}
    >
      {children}
    </AdminRoleContext.Provider>
  );
}

export function useAdminRole() {
  const context = useContext(AdminRoleContext);

  if (!context) {
    throw new Error(
      "useAdminRole must be used inside AdminRoleProvider"
    );
  }

  return context;
}
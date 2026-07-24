export type AdminRole =
  | "admin"
  | "engineer"
  | "accountant"
  | "employee";

export type AdminPermission =
  | "view_clients"
  | "manage_clients"
  | "manage_updates"
  | "manage_images"
  | "manage_files"
  | "manage_finance"
  | "manage_notifications"
  | "view_reports"
  | "manage_users"
  | "view_activity";

export const roleLabels: Record<AdminRole, string> = {
  admin: "مدير النظام",
  engineer: "مهندس",
  accountant: "محاسب",
  employee: "موظف",
};

const permissionMatrix: Record<AdminRole, AdminPermission[]> = {
  admin: [
    "view_clients",
    "manage_clients",
    "manage_updates",
    "manage_images",
    "manage_files",
    "manage_finance",
    "manage_notifications",
    "view_reports",
    "manage_users",
    "view_activity",
  ],

  engineer: [
    "view_clients",
    "manage_updates",
    "manage_images",
    "manage_files",
    "manage_notifications",
    "view_reports",
  ],

  accountant: [
    "view_clients",
    "manage_finance",
    "view_reports",
  ],

  employee: ["view_clients"],
};

export function isAdminRole(value: unknown): value is AdminRole {
  return (
    value === "admin" ||
    value === "engineer" ||
    value === "accountant" ||
    value === "employee"
  );
}

export function canAccess(
  role: AdminRole,
  permission: AdminPermission
): boolean {
  return permissionMatrix[role].includes(permission);
}

import type { Role } from "./types";

export interface RolePermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canManageStaff: boolean;
  canManagePlatformUsers: boolean;
}

const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  super_admin: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageStaff: true,
    canManagePlatformUsers: true,
  },
  tenant_admin: {
    canCreate: true,
    canEdit: true,
    canDelete: true,
    canManageStaff: true,
    canManagePlatformUsers: false,
  },
  staff_user: {
    canCreate: false,
    canEdit: false,
    canDelete: false,
    canManageStaff: false,
    canManagePlatformUsers: false,
  },
};

export const getRolePermissions = (role: Role | null): RolePermissions => {
  if (!role) {
    return {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canManageStaff: false,
      canManagePlatformUsers: false,
    };
  }

  return ROLE_PERMISSIONS[role];
};

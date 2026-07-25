import { useAppSelector } from "./useAppSelector";

export interface Permissions {
  canView:   boolean;
  canCreate: boolean;
  canEdit:   boolean;
  canDelete: boolean;
}

const ALL_ALLOWED: Permissions = {
  canView: true, canCreate: true, canEdit: true, canDelete: true,
};
const NONE_ALLOWED: Permissions = {
  canView: false, canCreate: false, canEdit: false, canDelete: false,
};

/**
 * Returns CRUD permissions for the given menu slug.
 * Super admin always gets full access.
 * Other users get permissions derived from the menuPermissions stored at login.
 */
export function usePermissions(menuSlug: string): Permissions {
  const user            = useAppSelector((s) => s.auth.user);
  const menuPermissions = useAppSelector((s) => s.auth.menuPermissions);

  if (!user) return NONE_ALLOWED;
  if (user.role === "super_admin") return ALL_ALLOWED;

  const entry = (menuPermissions ?? []).find((mp) => mp.menu.slug === menuSlug);
  if (!entry) return NONE_ALLOWED;

  return {
    canView:   entry.permissions.includes("view"),
    canCreate: entry.permissions.includes("create"),
    canEdit:   entry.permissions.includes("edit"),
    canDelete: entry.permissions.includes("delete"),
  };
}

import { useMemo } from "react";
import { useAppSelector } from "./useAppSelector";

export const useCurrentUser = () => {
  const user = useAppSelector((state) => state.auth.user);
  const role = user?.role ?? null;
  const featureFlags = user?.featureFlags ?? {};

  return useMemo(
    () => ({
      user,
      role,
      isSuperAdmin: role === "super_admin",
      isTenantAdmin: role === "tenant_admin",
      isStaffUser: role === "staff_user",
      featureFlags,
      hasSpecialitiesFeature: role === "super_admin" || !!featureFlags.specialities,
    }),
    [role, user, featureFlags]
  );
};

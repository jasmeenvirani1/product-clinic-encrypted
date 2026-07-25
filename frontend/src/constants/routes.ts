export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  DASHBOARD: "/dashboard",
  USERS: "/users",
  USER_DETAIL: (id: string) => `/users/${id}`,
  SETTINGS: "/settings",
} as const;

export const PUBLIC_ROUTES = [ROUTES.LOGIN] as const;

export const SIDEBAR_NAV = [
  { label: "Dashboard", href: ROUTES.DASHBOARD, icon: "LayoutDashboard" },
  { label: "Users", href: ROUTES.USERS, icon: "Users" },
  { label: "Settings", href: ROUTES.SETTINGS, icon: "Settings" },
] as const;

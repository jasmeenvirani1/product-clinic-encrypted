import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import authReducer, { logout, setUser } from "./slices/authSlice";
import tenantReducer from "./slices/tenantSlice";
import leadsReducer from "./slices/leadsSlice";
import conversationsReducer from "./slices/conversationsSlice";
import dashboardReducer from "./slices/dashboardSlice";
import uiReducer, { toggleSidebar } from "./slices/uiSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    tenant: tenantReducer,
    leads: leadsReducer,
    conversations: conversationsReducer,
    dashboard: dashboardReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

/** Convenience hook that replaces a Zustand-style `useStore` call. */
export function useStore() {
  const dispatch = useDispatch<AppDispatch>();
  const user            = useSelector((s: RootState) => s.auth.user);
  const menuPermissions = useSelector((s: RootState) => s.auth.menuPermissions);
  const isAuthenticated = useSelector((s: RootState) => s.auth.status === "authenticated");
  const sidebarOpen     = useSelector((s: RootState) => !s.ui.sidebarCollapsed);

  return {
    user,
    menuPermissions,
    isAuthenticated,
    sidebarOpen,
    toggleSidebar: () => dispatch(toggleSidebar()),
    setUser: (u: RootState["auth"]["user"]) => dispatch(setUser(u)),
    clearAuth: () => dispatch(logout()),
  };
}

"use client";

import { Layout } from "antd";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { HeaderBar } from "@/components/HeaderBar";
import { TrialBanner } from "@/components/TrialBanner";
import { PlanExpiredBanner } from "@/components/PlanExpiredBanner";
import { useAppDispatch } from "@/hooks/useAppDispatch";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { fetchMeThunk, setPlanExpired } from "@/store/slices/authSlice";
import { buildMenuFromPermissions } from "@/navigation/menus";

const { Content } = Layout;

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const collapsed       = useAppSelector((state) => state.ui.sidebarCollapsed);
  const menuPermissions = useAppSelector((state) => state.auth.menuPermissions);
  const permissionsLoading = useAppSelector((state) => state.auth.permissionsLoading);
  const token           = useAppSelector((state) => state.auth.token);
  const { user, role, featureFlags } = useCurrentUser();
  const dispatch        = useAppDispatch();
  const router          = useRouter();

  useEffect(() => {
    if (!user) {
      router.push("/login");
    } else if (user.role === "super_admin") {
      router.push("/super-admin/dashboard");
    }
  }, [user, router]);

  // Always re-fetch permissions on mount so revoked permissions take effect immediately.
  // This prevents stale cached permissions from showing menus the user no longer has access to.
  useEffect(() => {
    if (token && user && user.role !== "super_admin") {
      void dispatch(fetchMeThunk());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("crm_theme");
  }, []);

  useEffect(() => {
    const handler = () => dispatch(setPlanExpired());
    window.addEventListener("plan-expired", handler);
    return () => window.removeEventListener("plan-expired", handler);
  }, [dispatch]);

  // Bail out before painting the tenant sidebar for users that don't belong here.
  // The redirect effect above will push them to the correct destination; rendering
  // the wrong shell for one tick is what produces the menu flash.
  if (!user || user.role === "super_admin") return null;

  // Build sidebar strictly from backend permissions — no static fallback.
  // An empty array means the user has no permissions (or they haven't loaded yet).
  const menu = buildMenuFromPermissions(menuPermissions ?? [], role ?? "staff_user", featureFlags);

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Sidebar
        brand="Clinic CRM"
        items={menu}
        collapsed={collapsed}
        permissionsLoading={permissionsLoading && menu.length === 0}
      />
      <Layout className={`min-h-screen transition-all duration-300 ${collapsed ? "ml-[72px]" : "ml-[256px]"}`}>
        <HeaderBar />
        <PlanExpiredBanner />
        <TrialBanner />
        <Content className="bg-slate-50 px-6 py-6">
          <div className="mx-auto max-w-[1600px]">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

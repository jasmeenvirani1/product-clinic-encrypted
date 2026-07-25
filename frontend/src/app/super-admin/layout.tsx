"use client";

import { Layout } from "antd";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { HeaderBar } from "@/components/HeaderBar";
import { useAppSelector } from "@/hooks/useAppSelector";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { superAdminMenu, getVisibleMenu } from "@/navigation/menus";

const { Content } = Layout;

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const collapsed  = useAppSelector((state) => state.ui.sidebarCollapsed);
  const authStatus = useAppSelector((state) => state.auth.status);
  const { user, role } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    // Auth is still resolving (loginThunk in flight) — wait before making any
    // redirect decision so the super_admin role has time to land in the store.
    if (authStatus === "loading") return;
    if (!user) {
      router.push("/login");
    } else if (user.role !== "super_admin") {
      router.push("/app/dashboard");
    }
  }, [user, router, authStatus]);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
    localStorage.removeItem("crm_theme");
  }, []);

  // Don't render the super-admin shell for non-super-admins — the redirect effect
  // above will push them away. Rendering for one tick on the wrong role would
  // briefly show the super-admin menu and then flip.
  if (!user || user.role !== "super_admin") return null;

  const menu = getVisibleMenu(superAdminMenu, role);

  return (
    <Layout className="min-h-screen bg-slate-50">
      <Sidebar brand="Platform Control" items={menu} collapsed={collapsed} />
      <Layout className={`min-h-screen transition-all duration-300 ${collapsed ? "ml-[72px]" : "ml-[256px]"}`}>
        <HeaderBar />
        <Content className="bg-slate-50 px-6 py-6">
          <div className="w-full">{children}</div>
        </Content>
      </Layout>
    </Layout>
  );
}

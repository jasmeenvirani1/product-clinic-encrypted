"use client";

import { Layout, Menu } from "antd";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck, LayoutDashboard, Users, Settings } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store";
import type { MenuEntry } from "../../utils/types";
import { APP_NAME } from "../../constants/brand";

const { Sider } = Layout;

interface SidebarProps {
  brand: string;
  items: MenuEntry[];
  collapsed: boolean;
}

export const Sidebar = ({ brand, items, collapsed }: SidebarProps) => {
  const pathname = usePathname();

  return (
    <Sider
      theme="light"
      trigger={null}
      width={260}
      collapsedWidth={88}
      collapsed={collapsed}
      className="!fixed !left-0 !top-0 !h-screen border-r border-slate-200 !bg-white"
      style={{ backgroundColor: "#ffffff" }}
    >
      <Link href="/" className="flex h-20 items-center gap-3 border-b border-slate-200 px-6">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-blue-700 text-white shadow-lg">
          <ShieldCheck size={22} />
        </div>
        {!collapsed ? (
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">{APP_NAME}</p>
            <h2 className="text-lg font-semibold text-slate-900">{brand}</h2>
          </div>
        ) : null}
      </Link>
      <div className="px-3 py-4">
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={items.map((item) => ({
            key: item.path,
            icon: item.icon,
            label: <Link href={item.path}>{item.label}</Link>,
          }))}
          className="crm-menu border-0 bg-transparent"
        />
      </div>
    </Sider>
  );
};

const DEFAULT_NAV_ITEMS: MenuEntry[] = [
  { key: "dashboard", label: "Dashboard", icon: <LayoutDashboard size={18} />, path: "/dashboard", roles: ["super_admin", "tenant_admin", "staff_user"] },
  { key: "users",     label: "Users",     icon: <Users size={18} />,           path: "/users",     roles: ["super_admin", "tenant_admin"] },
  { key: "settings",  label: "Settings",  icon: <Settings size={18} />,        path: "/settings",  roles: ["super_admin", "tenant_admin", "staff_user"] },
];

/** Default export — zero-prop wrapper used by the dashboard layout. */
export default function SidebarConnected() {
  const collapsed = useSelector((s: RootState) => s.ui.sidebarCollapsed);
  return <Sidebar brand="Admin" items={DEFAULT_NAV_ITEMS} collapsed={collapsed} />;
}

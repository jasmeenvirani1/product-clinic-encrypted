"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar, Layout, Menu } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bot, ChevronUp, Gauge, Globe, KeyRound, LayoutList, LogOut, Settings, ShieldCheck, User } from "lucide-react";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { logout } from "../store/slices/authSlice";
import type { MenuEntry } from "../utils/types";
import { useThemeColors } from "@/providers/ThemeProvider";
import { LogoMark } from "./LogoMark";

const { Sider } = Layout;

// /uploads/* is served from the API origin root (not under /api) — strip the
// /api suffix from the configured base URL to build absolute logo URLs.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(/\/api\/?$/, "");

interface SidebarProps {
  brand: string;
  items: MenuEntry[];
  collapsed: boolean;
  permissionsLoading?: boolean;
}


export const Sidebar = ({ brand, items, collapsed, permissionsLoading = false }: SidebarProps) => {
  const pathname   = usePathname();
  const dispatch   = useAppDispatch();
  const router     = useRouter();
  const user       = useAppSelector((state) => state.auth.user);
  const { platformName, platformShortName } = useThemeColors();
  const role       = user?.role ?? "staff_user";
  const clinicDisplayName = user?.clinic_name || brand;

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    if (profileOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [profileOpen]);

  const menuLabel = (item: MenuEntry) => item.label;
  const profileLabel = (_key: string, fallback: string) => fallback;

  const profileMenuItems = role === "super_admin"
    ? [
        {
          key: "settings",
          icon: <Settings size={14} />,
          label: profileLabel("settings", "Settings"),
          href: "/super-admin/settings",
        },
        {
          key: "logs",
          icon: <Gauge size={14} />,
          label: profileLabel("logs", "System Logs"),
          href: "/super-admin/logs",
        },
        {
          key: "ai-settings",
          icon: <Bot size={14} />,
          label: profileLabel("aiSettings", "AI Settings"),
          href: "/super-admin/ai-settings",
        },
        {
          key: "website-content",
          icon: <Globe size={14} />,
          label: profileLabel("websiteContent", "Website Content"),
          href: "/super-admin/landing-page",
        },
      ]
    : [
        {
          key: "profile",
          icon: <User size={14} />,
          label: profileLabel("profile", "Profile"),
          href: "/app/settings",
        },
      ];

  const rbacMenuItems = role === "super_admin"
    ? [
        {
          key: "roles",
          icon: <ShieldCheck size={14} />,
          label: profileLabel("roles", "Roles"),
          href: "/super-admin/roles",
        },
        {
          key: "permissions",
          icon: <KeyRound size={14} />,
          label: profileLabel("permissions", "Permissions"),
          href: "/super-admin/permissions",
        },
        {
          key: "menus",
          icon: <LayoutList size={14} />,
          label: profileLabel("menus", "Menu Items"),
          href: "/super-admin/menus",
        },
      ]
    : [];

  const handleLogout = () => {
    setProfileOpen(false);
    dispatch(logout());
    // Hard navigation clears the previous user's React tree and router cache so
    // the next login can use a fast soft-nav without stale state bleeding through.
    window.location.href = "/login";
  };

  return (
    <Sider
      theme="light"
      trigger={null}
      width={256}
      collapsedWidth={72}
      collapsed={collapsed}
      className="!fixed !left-0 !top-0 !h-screen"
      style={{
        borderRight: "1px solid var(--color-brand-border)",
        backgroundColor: "var(--color-sidebar-bg)",
      }}
    >
      {/* Brand — shows the clinic's own uploaded logo/name once logged in;
          falls back to the platform LogoMark + name when neither is set. */}
      <Link
        href="/"
        className="flex h-16 items-center gap-3 px-4"
        style={{ borderBottom: "1px solid var(--color-brand-border)" }}
      >
        {user?.logo_url ? (
          <img
            src={user.logo_url.startsWith("http") ? user.logo_url : `${API_ORIGIN}${user.logo_url}`}
            alt={clinicDisplayName}
            className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm"
          />
        ) : user?.clinic_name ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-white shadow-sm"
            style={{ backgroundColor: "var(--color-primary)" }}
          >
            {clinicDisplayName.charAt(0).toUpperCase()}
          </div>
        ) : (
          <LogoMark size="md" className="shadow-sm" shortName={platformShortName} />
        )}
        {!collapsed ? (
          <div className="overflow-hidden">
            <p className="truncate text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {platformName}
            </p>
            <p className="truncate text-sm font-semibold" style={{ color: "var(--color-brand-heading)" }}>
              {clinicDisplayName}
            </p>
          </div>
        ) : null}
      </Link>

      {/* Nav items — scrollable, takes remaining height */}
      <div className="sidebar-scrollbar flex h-[calc(100vh-8rem)] flex-col overflow-y-auto px-2 py-3">
        {permissionsLoading ? (
          <div className="space-y-2 px-2 py-1">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className={`h-9 animate-pulse rounded-md bg-slate-100 ${collapsed ? "mx-auto w-9" : "w-full"}`}
              />
            ))}
          </div>
        ) : (
          <Menu
            mode="inline"
            selectedKeys={[items.find((item) => pathname.startsWith(item.path))?.path ?? pathname]}
            inlineIndent={12}
            items={items.map((item) => ({
              key:   item.path,
              icon:  item.icon,
              label: <Link href={item.path}>{menuLabel(item)}</Link>,
            }))}
            className="crm-menu !border-0 !bg-transparent"
            style={{ color: "var(--color-text-body)", fontSize: "13.5px" }}
          />
        )}
      </div>

      {/* Profile section at bottom */}
      <div
        ref={profileRef}
        className="absolute bottom-0 left-0 right-0"
        style={{ zIndex: 50 }}
      >
        {/* Upward dropdown panel */}
        {profileOpen && (
          <div
            className="mx-2 mb-1 overflow-hidden rounded-xl shadow-lg"
            style={{
              border: "1px solid var(--color-brand-border)",
              backgroundColor: "var(--color-sidebar-bg)",
              animation: "slideUpFade 0.18s ease-out",
            }}
          >
            {profileMenuItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                  style={isActive
                    ? { backgroundColor: "var(--color-sidebar-active)", color: "var(--color-primary)", fontWeight: 500 }
                    : { color: "var(--color-text-body)" }
                  }
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-sidebar-hover)"; }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                >
                  <span style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" }}>{item.icon}</span>
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );
            })}

            {rbacMenuItems.length > 0 && (
              <>
                <div style={{ borderTop: "1px solid var(--color-brand-border)" }}>
                  {!collapsed && (
                    <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Access Control
                    </p>
                  )}
                  {rbacMenuItems.map((item) => {
                    const isActive = pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors"
                        style={isActive
                          ? { backgroundColor: "var(--color-sidebar-active)", color: "var(--color-primary)", fontWeight: 500 }
                          : { color: "var(--color-text-body)" }
                        }
                        onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-sidebar-hover)"; }}
                        onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.backgroundColor = ""; }}
                      >
                        <span style={{ color: isActive ? "var(--color-primary)" : "var(--color-text-muted)" }}>{item.icon}</span>
                        {!collapsed && <span>{item.label}</span>}
                        {isActive && !collapsed && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "var(--color-primary)" }} />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 transition-colors hover:bg-red-50"
              style={{ borderTop: "1px solid var(--color-brand-border)" }}
            >
              <LogOut size={14} />
              {!collapsed && <span>Logout</span>}
            </button>
          </div>
        )}

        {/* Profile trigger button */}
        <button
          type="button"
          onClick={() => setProfileOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 transition-colors"
          style={{
            borderTop: "1px solid var(--color-brand-border)",
            backgroundColor: profileOpen ? "var(--color-sidebar-hover)" : "var(--color-sidebar-bg)",
          }}
          onMouseEnter={e => { if (!profileOpen) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-sidebar-hover)"; }}
          onMouseLeave={e => { if (!profileOpen) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--color-sidebar-bg)"; }}
        >
          <Avatar
            size={32}
            className="shrink-0 text-xs font-semibold"
            style={{ backgroundColor: "var(--color-sidebar-active)", color: "var(--color-primary)" }}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold leading-none text-slate-900">
                  {user?.name ?? "User"}
                </p>
                <p className="mt-0.5 truncate text-[11px] leading-none text-slate-400">
                  {user?.email ?? ""}
                </p>
              </div>
              <ChevronUp
                size={14}
                className={`shrink-0 text-slate-400 transition-transform duration-200 ${profileOpen ? "rotate-180" : ""}`}
              />
            </>
          )}
        </button>
      </div>
    </Sider>
  );
};

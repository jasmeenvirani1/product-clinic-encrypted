"use client";

import { Menu, LogOut, User } from "lucide-react";
import { useStore } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { getInitials } from "@/lib/utils";

export default function Header() {
  const { toggleSidebar } = useStore();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <button
        onClick={toggleSidebar}
        className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="hidden lg:block">
        <button
          onClick={toggleSidebar}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-lg px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-600 text-xs font-medium text-white">
            {user ? getInitials(user.name) : <User className="h-4 w-4" />}
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-700">{user?.name || "Guest"}</p>
            <p className="text-xs text-gray-500">{user?.role || ""}</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-red-600"
          title="Logout"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

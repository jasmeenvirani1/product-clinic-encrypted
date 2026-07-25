"use client";

import { Button } from "antd";
import { Menu } from "lucide-react";
import { useAppDispatch } from "../hooks/useAppDispatch";
import { useAppSelector } from "../hooks/useAppSelector";
import { toggleSidebar } from "../store/slices/uiSlice";

const roleLabelMap: Record<string, { label: string; dot: string }> = {
  super_admin:  { label: "Super Admin",   dot: "bg-violet-500" },
  tenant_admin: { label: "Admin",  dot: "bg-teal-500" },
  staff_user:   { label: "Staff",         dot: "bg-emerald-500" },
};

export const HeaderBar = () => {
  const dispatch = useAppDispatch();
  const user     = useAppSelector((state) => state.auth.user);
  const role     = user?.role ?? "staff_user";
  const roleInfo = roleLabelMap[role] ?? roleLabelMap.staff_user;

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between bg-white px-5"
      style={{ borderBottom: "1px solid #e2e8f0" }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <Button
          type="text"
          icon={<Menu size={17} className="text-slate-500" />}
          onClick={() => dispatch(toggleSidebar())}
          className="!rounded-lg"
        />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* Role badge */}
        <span className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
          <span className={`h-1.5 w-1.5 rounded-full ${roleInfo.dot}`} />
          {roleInfo.label}
        </span>
      </div>
    </header>
  );
};

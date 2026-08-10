"use client";

import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, Popover, Spin } from "antd";
import { Bell } from "lucide-react";
import { notificationService, type AppNotification } from "@/services/notification.service";
import { formatDateTime } from "@/lib/utils";

const AI_CREDENTIAL_TITLE_FALLBACK = "Notification";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await notificationService.list();
      setNotifications(list);
    } catch {
      setError("Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void load();
  };

  const handleItemClick = async (item: AppNotification) => {
    if (!item.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
      try {
        await notificationService.markRead(item.id);
      } catch {
        // Revert on failure so the UI doesn't lie about read state.
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: false } : n))
        );
      }
    }
  };

  const content = (
    <div className="w-80">
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <span className="text-sm font-semibold text-slate-800">Notifications</span>
        {unreadCount > 0 && (
          <span className="text-xs font-medium text-primary">{unreadCount} unread</span>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spin size="small" />
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center text-sm text-rose-600">{error}</div>
        ) : notifications.length === 0 ? (
          <div className="py-6">
            <Empty description="No notifications yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void handleItemClick(item)}
                  className={`flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${
                    item.is_read ? "" : "bg-primary-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {item.title || AI_CREDENTIAL_TITLE_FALLBACK}
                    </span>
                    {!item.is_read && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary-600" />
                    )}
                  </div>
                  <span className="text-xs leading-snug text-slate-600">{item.body}</span>
                  <span className="mt-0.5 text-[11px] text-slate-400">
                    {formatDateTime(item.created_at)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottomRight"
      styles={{ body: { padding: 0 } }}
    >
      <Button type="text" className="!rounded-lg" title="Notifications">
        <Badge count={unreadCount} size="small" offset={[-2, 2]}>
          <Bell size={17} className="text-slate-500" />
        </Badge>
      </Button>
    </Popover>
  );
}

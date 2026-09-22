"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "@/components/icons";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell({ userEmail }: { userEmail: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userEmail]);

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    } finally {
      setLoading(false);
    }
  }

  async function markAsRead(notificationId: string) {
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId })
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
    }
  }

  async function markAllAsRead() {
    try {
      await fetch("/api/notifications/mark-all-read", {
        method: "POST"
      });
      fetchNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  }

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-chart text-[0.625rem] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-96 rounded-2xl border border-line bg-white shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h3 className="text-sm font-semibold text-ink">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllAsRead}
                  className="text-xs font-medium text-chart hover:text-chartdark"
                >
                  Mark all as read
                </button>
              )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-slate1">Loading...</div>
              ) : recentNotifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate1">No notifications</div>
              ) : (
                <div className="divide-y divide-line">
                  {recentNotifications.map((notif) => (
                    <Link
                      key={notif.id}
                      href={notif.link}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id);
                        setIsOpen(false);
                      }}
                      className={`block px-4 py-3 transition hover:bg-surface ${!notif.read ? "bg-chartsoft/30" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        {!notif.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-chart" />}
                        <div className={`flex-1 ${!notif.read ? "" : "ml-5"}`}>
                          <p className="text-sm font-medium text-ink">{notif.title}</p>
                          <p className="mt-0.5 text-xs text-slate1">{notif.message}</p>
                          <p className="mt-1 text-[0.6875rem] text-slate1">
                            {new Date(notif.createdAt).toLocaleDateString("en-IN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit"
                            })}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {notifications.length > 5 && (
              <div className="border-t border-line px-4 py-3 text-center">
                <Link
                  href="/notifications"
                  onClick={() => setIsOpen(false)}
                  className="text-sm font-medium text-chart hover:text-chartdark"
                >
                  View all notifications
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * In-app notifications storage
 */
import { readJson, writeJson } from "./driver";

export interface InAppNotification {
  id: string;
  userId: string;
  type: "task_assigned" | "report_assigned" | "status_change" | "approval_request" | "task_completed";
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

const NOTIFICATIONS_KEY = "notifications";

export async function listNotifications(userId: string): Promise<InAppNotification[]> {
  try {
    const all = await readJson<InAppNotification[]>(NOTIFICATIONS_KEY);
    if (!Array.isArray(all)) return [];
    return all.filter(n => n.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return [];
  }
}

export async function createNotification(notification: Omit<InAppNotification, "id" | "read" | "createdAt">): Promise<void> {
  const all = await readJson<InAppNotification[]>(NOTIFICATIONS_KEY).catch(() => []) as InAppNotification[];
  const newNotification: InAppNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    read: false,
    createdAt: new Date().toISOString()
  };
  await writeJson(NOTIFICATIONS_KEY, [...all, newNotification], "Create notification", { name: "System", email: "system@airindia.com" });
}

export async function markAsRead(notificationId: string): Promise<void> {
  const all = await readJson<InAppNotification[]>(NOTIFICATIONS_KEY).catch(() => []) as InAppNotification[];
  const updated = all.map(n => n.id === notificationId ? { ...n, read: true } : n);
  await writeJson(NOTIFICATIONS_KEY, updated, "Mark notification as read", { name: "System", email: "system@airindia.com" });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const all = await readJson<InAppNotification[]>(NOTIFICATIONS_KEY).catch(() => []) as InAppNotification[];
  const updated = all.map(n => n.userId === userId ? { ...n, read: true } : n);
  await writeJson(NOTIFICATIONS_KEY, updated, "Mark all notifications as read", { name: "System", email: "system@airindia.com" });
}

export async function getUnreadCount(userId: string): Promise<number> {
  const notifications = await listNotifications(userId);
  return notifications.filter(n => !n.read).length;
}

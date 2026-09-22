import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { listNotifications, getUnreadCount } from "@/lib/store/notifications";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const notifications = await listNotifications(user.email);
  const unreadCount = await getUnreadCount(user.email);

  return NextResponse.json({ notifications, unreadCount });
}

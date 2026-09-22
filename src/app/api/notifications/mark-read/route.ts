import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { markAsRead } from "@/lib/store/notifications";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { notificationId } = await req.json();
  await markAsRead(notificationId);

  return NextResponse.json({ success: true });
}

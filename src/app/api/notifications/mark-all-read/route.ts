import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { markAllAsRead } from "@/lib/store/notifications";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await markAllAsRead(user.email);

  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { currentUser } from "@/lib/session";
import { formsForDepartment } from "@/lib/forms";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json((await formsForDepartment(user.department)).map((f) => f.meta));
}

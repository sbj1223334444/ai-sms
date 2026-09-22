import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllForms } from "@/lib/forms";
import { checkAndSaveForm } from "@/lib/form-admin";

export const dynamic = "force-dynamic";

/** Every form, active and retired, for Administration → Forms. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "admin.manageForms")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  return NextResponse.json(await listAllForms());
}

/** Create a form. */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "admin.manageForms")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const result = await checkAndSaveForm(await req.json(), commitAuthor(user), { isNew: true });
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: result.status });
  return NextResponse.json(result.form, { status: 201 });
}

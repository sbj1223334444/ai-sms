import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getForm } from "@/lib/forms";
import { checkAndSaveForm } from "@/lib/form-admin";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { formId: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "admin.manageForms")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  const def = await getForm(params.formId, { includeRetired: true });
  if (!def) return NextResponse.json({ error: "Form not found" }, { status: 404 });
  return NextResponse.json(def);
}

/** Save a new version of a form, including retiring or reactivating it. The form ID never changes. */
export async function PUT(req: NextRequest, { params }: { params: { formId: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "admin.manageForms")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const result = await checkAndSaveForm(await req.json(), commitAuthor(user), { isNew: false, formId: params.formId });
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: result.status });
  return NextResponse.json(result.form);
}

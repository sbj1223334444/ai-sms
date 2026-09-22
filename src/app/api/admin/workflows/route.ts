import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllForms } from "@/lib/forms";
import { normaliseTemplate } from "@/lib/workflow";
import { workflowTemplates, saveWorkflowTemplate } from "@/lib/workflow-templates";
import type { StageTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "admin.manageWorkflows")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
  return NextResponse.json(await workflowTemplates());
}

/**
 * Save one workflow (US-18). Body: { target: "default" | formId, stages: StageTemplate[] | null }.
 * `stages: null` sends a report type back to the default. Reports already filed are not touched.
 */
export async function PUT(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "admin.manageWorkflows")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = (await req.json()) as { target?: string; stages?: StageTemplate[] | null };
  const target = body.target ?? "";
  if (target !== "default" && !(await listAllForms()).some((f) => f.meta.formId === target)) {
    return NextResponse.json({ errors: ["Unknown report type."] }, { status: 404 });
  }

  if (body.stages === null) {
    if (target === "default") return NextResponse.json({ errors: ["The default workflow cannot be removed."] }, { status: 422 });
    return NextResponse.json(await saveWorkflowTemplate(target, null, commitAuthor(user)));
  }
  if (!Array.isArray(body.stages)) return NextResponse.json({ errors: ["Send the stages to save."] }, { status: 400 });

  const stages = body.stages.map((s) => ({ key: String(s?.key ?? ""), name: String(s?.name ?? ""), taskDays: Number(s?.taskDays) }));
  const result = normaliseTemplate(stages);
  if (!result.ok) return NextResponse.json({ errors: result.errors }, { status: 422 });
  return NextResponse.json(await saveWorkflowTemplate(target, result.stages, commitAuthor(user)));
}

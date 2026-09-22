import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { getForm, isVisibleTo, gatekeeperGroupFor, extraValidation } from "@/lib/forms";
import { listIndex, nextId, putReport, storeConfigured } from "@/lib/store";
import { buildWorkflow } from "@/lib/workflow";
import { workflowTemplates } from "@/lib/workflow-templates";
import { can, canSeeReport } from "@/lib/rbac";
import { notify } from "@/lib/notify";
import type { Report } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!storeConfigured()) return NextResponse.json({ error: "Datastore is not configured. Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_DATA_REPO." }, { status: 503 });

  const mine = req.nextUrl.searchParams.get("mine") === "true";
  const rows = await listIndex();

  if (mine) return NextResponse.json(rows.filter((r) => r.raisedBy === user.name));
  if (!can(user.role, "report.viewAllNew")) return NextResponse.json([]);

  return NextResponse.json(
    rows.filter((r) =>
      canSeeReport(
        { email: user.email, role: user.role, department: user.department, groups: user.groups, scope: user.scope },
        { investigator: r.investigator, gatekeeperGroup: r.gatekeeperGroup, department: r.department }
      )
    )
  );
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "report.submit")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = (await req.json()) as { formId: string; data: Record<string, unknown>; attachments?: { name: string; size: number }[] };
  const def = await getForm(body.formId);
  if (!def) return NextResponse.json({ error: "Unknown form, or the form has been retired." }, { status: 404 });
  if (!isVisibleTo(def, user.department)) {
    return NextResponse.json({ error: "This form is not available to your department." }, { status: 403 });
  }

  const errors = extraValidation(def, body.data);
  if (def.meta.attachmentsRequired && !(body.attachments || []).length) {
    errors.push("This form requires at least one supporting document.");
  }
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  const author = commitAuthor(user);
  const seq = await nextId("report", author);
  const year = new Date().getFullYear();
  const id = `RPT-${year}-${String(seq).padStart(6, "0")}`;
  const confidential = def.meta.supportsConfidential && body.data.confidential === "Yes";
  const now = new Date().toISOString();

  const report: Report = {
    id,
    formId: def.meta.formId,
    formTitle: def.meta.title,
    formVersion: def.meta.version,
    status: "new",
    confidential,
    // A confidential report never carries the reporter's identity into storage. There is no
    // unmask feature because there is nothing stored to unmask.
    submittedBy: confidential
      ? undefined
      : { name: user.name, email: user.email, staffNo: user.staffNo, department: user.department },
    submittedAt: now,
    data: body.data,
    attachments: body.attachments ?? [],
    gatekeeperGroup: await gatekeeperGroupFor(def),
    sras: [],
    workflow: buildWorkflow(def.meta.formId, now, await workflowTemplates()),
    tasks: [],
    timeline: [{ at: now, actor: confidential ? "Confidential" : user.name, action: "Report submitted" }]
  };

  await putReport(report, `feat(report): submit ${id} (${def.meta.code})`, author);

  if (!confidential) {
    await notify({
      to: user.email,
      subject: `Safety report received - ${id}`,
      body: `Your ${def.meta.title} has been received and sent to the safety team for review.\n\nReport ID: ${id}\nSubmitted: ${new Date(now).toLocaleString("en-IN")}`,
      link: `${req.nextUrl.origin}/my-submissions`
    });
  }

  return NextResponse.json({ id, safetyRef: null }, { status: 201 });
}

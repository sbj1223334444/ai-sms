import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { getReport, listTasks, nextId, putTask, addTaskToIndex, putReport } from "@/lib/store";
import { can } from "@/lib/rbac";
import { notify, taskNotification } from "@/lib/notify";
import { staffDirectory } from "@/lib/demo-users";
import { getForm } from "@/lib/forms";
import { editableSections } from "@/lib/report-edit";
import { taskType } from "@/lib/tasks";
import { canWorkOn, workBlockedReason } from "@/lib/ownership";
import type { Task, TaskType } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const all = await listTasks();
  const reportId = req.nextUrl.searchParams.get("reportId");
  if (reportId) return NextResponse.json(all.filter((t) => t.reportId === reportId));
  // "My tasks" is universal: anyone in the organisation can hold a task.
  return NextResponse.json(all.filter((t) => t.assignee === user.email || t.createdBy === user.email));
}

const PRIORITIES = ["Low", "Medium", "High"] as const;

/** Raise a task from a report's Workflow tab (BRD 3.4, US-08 criteria 1 to 5). */
export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!can(user.role, "task.create")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  const body = await req.json();
  const loaded = await getReport(body.reportId);
  if (!loaded) return NextResponse.json({ error: "Report not found" }, { status: 404 });
  const report = loaded.data;

  const kind = taskType(body.type as TaskType);
  if (!kind) return NextResponse.json({ error: "Choose what the task is for." }, { status: 422 });
  if (!["in_progress", "pending_risk_approval"].includes(report.status)) {
    return NextResponse.json({ error: "Tasks can be raised only while the report is under investigation." }, { status: 409 });
  }
  if (!canWorkOn(user, report)) {
    const holderName = staffDirectory(user).find((p) => p.email === report.triage?.investigator)?.name;
    return NextResponse.json({ error: workBlockedReason(user, report, holderName) }, { status: 403 });
  }

  const title = String(body.title ?? "").trim();
  const description = String(body.description ?? "").trim();
  const today = new Date().toISOString().slice(0, 10);
  const errors: string[] = [];
  if (!title) errors.push("Give the task a title.");
  if (title.length > 120) errors.push("Keep the title under 120 characters.");
  if (!description) errors.push("Tell the assignee what you need in the description.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate ?? "")) errors.push("Set a due date. Task dates are always chosen manually.");
  else if (body.dueDate < today) errors.push("The due date cannot be in the past.");
  const priority = PRIORITIES.includes(body.priority) ? (body.priority as Task["priority"]) : "Medium";

  const stage = report.workflow.find((s) => s.key === body.stageKey);
  if (!stage) errors.push("Choose the workflow stage this task belongs to.");
  else if (stage.status === "complete") errors.push(`"${stage.name}" is complete. Raise the task on a stage that is still open.`);

  // Who gets it: the report's own reporter for a reporter request, otherwise anyone in the directory.
  let assignee = "";
  let assigneeName = "";
  if (kind.assignee === "reporter") {
    if (report.confidential || !report.submittedBy) {
      errors.push("This report was filed confidentially, so the reporter cannot be contacted. Ask someone else instead.");
    } else {
      assignee = report.submittedBy.email;
      assigneeName = report.submittedBy.name;
    }
  } else {
    const person = staffDirectory(user).find((p) => p.email === body.assignee);
    if (!person) errors.push("Pick the assignee from the staff directory.");
    else {
      assignee = person.email;
      assigneeName = person.name;
    }
  }

  // Edit access: only where the task type allows it, and only for sections that exist on the form.
  const formEditAccess = kind.formEdit !== "none" && body.formEditAccess === true;
  let sections: string[] = [];
  if (formEditAccess) {
    const def = await getForm(report.formId, { includeRetired: true });
    const valid = new Set(editableSections(def ?? { schema: {}, uiSchema: {} }).map((s) => s.key));
    sections = (Array.isArray(body.editableSections) ? body.editableSections : []).filter((k: unknown) => typeof k === "string" && valid.has(k));
    if (!sections.length) errors.push("Choose at least one section of the report they can edit, or turn edit access off.");
  }

  let controlId: string | undefined;
  if (kind.control && body.controlId) {
    const exists = report.sras.some((s) => s.hazards.some((h) => h.controls.some((c) => c.id === body.controlId)));
    if (!exists) errors.push("That control is not on this report.");
    else controlId = body.controlId;
  }

  if (errors.length) return NextResponse.json({ error: errors.join(" "), errors }, { status: 422 });

  const author = commitAuthor(user);
  const seq = await nextId("task", author);
  const task: Task = {
    id: `TSK-${String(seq).padStart(6, "0")}`,
    reportId: report.id,
    reportType: report.formTitle,
    type: kind.type,
    stageKey: stage!.key,
    controlId,
    title,
    description,
    assignee,
    assigneeName,
    priority,
    dueDate: body.dueDate,
    formEditAccess,
    editableSections: sections,
    status: "open",
    createdBy: user.email,
    createdByName: user.name,
    createdAt: new Date().toISOString(),
    comments: []
  };

  await putTask(task, `feat(task): create ${task.id} (${task.type}) on ${task.reportId}`, author);
  await addTaskToIndex(task.id, author);

  report.tasks = [...report.tasks, task.id];
  report.timeline = [
    ...report.timeline,
    {
      at: task.createdAt,
      actor: user.name,
      action: "Task raised",
      detail: `${task.id}: ${kind.label} to ${assigneeName}, on "${stage!.name}", due ${task.dueDate}${formEditAccess ? `, with edit access to ${sections.length} section(s)` : ""}`
    }
  ];
  await putReport(report, `chore(report): link ${task.id}`, author, loaded.sha);

  // The notification carries the report type only - never the report ID or the narrative.
  await notify(
    taskNotification({
      to: task.assignee,
      reportType: task.reportType,
      title: task.title,
      dueDate: task.dueDate,
      assignedBy: user.name,
      taskId: task.id,
      baseUrl: req.nextUrl.origin
    })
  );

  return NextResponse.json(task, { status: 201 });
}

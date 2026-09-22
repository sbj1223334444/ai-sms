import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { getTask, putTask, getReport, putReport, removeTaskFromIndex } from "@/lib/store";
import { notify } from "@/lib/notify";
import { getForm, extraValidation } from "@/lib/forms";
import { describeChanges, diffAnswers, fieldLabels, recordEdit, sectionFields } from "@/lib/report-edit";
import { isTaskEditable } from "@/lib/tasks";
import { staffDirectory } from "@/lib/demo-users";
import type { Report, Task } from "@/lib/types";

export const dynamic = "force-dynamic";

/** What an assignee is allowed to see. Everything else on the report stays closed. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const loaded = await getTask(params.id);
  if (!loaded) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const task = loaded.data;
  const isParticipant = task.assignee === user.email || task.createdBy === user.email;
  if (!isParticipant) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

  let reportExtract = null;
  if (task.formEditAccess) {
    const r = await getReport(task.reportId);
    const def = r ? await getForm(r.data.formId, { includeRetired: true }) : null;
    if (r && def) {
      // Only the sections named at task creation are exposed, and never the investigation or SRA.
      const data: Record<string, unknown> = {};
      for (const key of sectionFields(def, task.editableSections)) data[key] = r.data.data[key];
      reportExtract = { formTitle: r.data.formTitle, editable: data };
    }
  }
  return NextResponse.json({ task, reportExtract });
}

/** Write a task event onto the report's timeline (US-08 criterion 16). */
async function logOnReport(task: Task, actor: string, action: string, detail: string, author: { name: string; email: string }, mutate?: (r: Report) => void) {
  const loaded = await getReport(task.reportId);
  if (!loaded) return;
  const report = loaded.data;
  mutate?.(report);
  report.timeline = [...report.timeline, { at: new Date().toISOString(), actor, action, detail }];
  await putReport(report, `chore(report): ${action.toLowerCase()} ${task.id}`, author, loaded.sha);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const loaded = await getTask(params.id);
  if (!loaded) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const task = loaded.data;
  const body = await req.json();
  const author = commitAuthor(user);
  const isAssignee = task.assignee === user.email;
  const report = await getReport(task.reportId);
  // Whoever raised the task reviews it, and so can the investigator the report is assigned to.
  const isReviewer = task.createdBy === user.email || report?.data.triage?.investigator === user.email;
  const link = `${req.nextUrl.origin}/report/${task.reportId}`;
  let message = "";

  if (task.status === "accepted" && body.action !== "comment") {
    return NextResponse.json({ error: "This task has been accepted and is closed." }, { status: 409 });
  }
  if (task.status === "cancelled") {
    return NextResponse.json({ error: "This task was deleted." }, { status: 409 });
  }

  switch (body.action) {
    case "saveProgress":
    case "complete": {
      if (!isAssignee) return NextResponse.json({ error: "Only the assignee can update this task." }, { status: 403 });
      const response = String(body.response ?? "").trim();
      if (body.action === "complete" && !response) return NextResponse.json({ error: "Write your response before marking the task complete." }, { status: 422 });
      task.response = response;
      task.status = body.action === "complete" ? "submitted" : "in_progress";
      message = `chore(task): ${task.status} ${task.id}`;
      if (task.status === "submitted") {
        await logOnReport(task, user.name, "Task completed", `${task.id}: ${task.title}`, author);
        await notify({
          to: task.createdBy,
          subject: `Task completed: ${task.title}`,
          body: `${user.name} has completed a task you raised on a ${task.reportType}.`,
          link
        });
      }
      break;
    }

    case "requestExtension": {
      if (!isAssignee) return NextResponse.json({ error: "Only the assignee can request an extension." }, { status: 403 });
      const until = String(body.until ?? "");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(until) || until <= task.dueDate) {
        return NextResponse.json({ error: `Choose a date after the current due date, ${task.dueDate}.` }, { status: 422 });
      }
      task.extensionRequested = until;
      message = `chore(task): extension requested on ${task.id}`;
      await logOnReport(task, user.name, "Task extension requested", `${task.id} to ${until}`, author);
      await notify({ to: task.createdBy, subject: `Extension requested: ${task.title}`, body: `${user.name} asks for more time, until ${until}.`, link });
      break;
    }

    case "comment": {
      if (!isAssignee && !isReviewer) return NextResponse.json({ error: "Only the assignee and the person who raised the task can comment." }, { status: 403 });
      const text = String(body.text ?? "").trim();
      if (!text) return NextResponse.json({ error: "Write a question or comment first." }, { status: 422 });
      task.comments = [...(task.comments ?? []), { at: new Date().toISOString(), by: user.name, byEmail: user.email, text }];
      message = `chore(task): comment on ${task.id}`;
      await logOnReport(task, user.name, "Task comment", `${task.id}: ${text.slice(0, 200)}`, author);
      await notify({
        to: isAssignee ? task.createdBy : task.assignee,
        subject: `New comment on task: ${task.title}`,
        body: `${user.name}: ${text}`,
        link: isAssignee ? link : `${req.nextUrl.origin}/tasks#${task.id}`
      });
      break;
    }

    /* The assignee fills in the report sections they were given (US-08 criterion 13). */
    case "editReport": {
      if (!isAssignee) return NextResponse.json({ error: "Only the assignee can edit through this task." }, { status: 403 });
      if (!task.formEditAccess || !task.editableSections.length) return NextResponse.json({ error: "This task does not give edit access to the report." }, { status: 403 });
      if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });
      if (typeof body.data !== "object" || body.data === null) return NextResponse.json({ error: "Send the answers to save." }, { status: 400 });

      const def = await getForm(report.data.formId, { includeRetired: true });
      const allowed = def ? sectionFields(def, task.editableSections) : [];
      const { data, changes } = diffAnswers(report.data.data, body.data, fieldLabels(def), allowed);
      if (!changes.length) return NextResponse.json({ error: "Nothing changed." }, { status: 422 });
      const problems = def ? extraValidation(def, data) : [];
      if (problems.length) return NextResponse.json({ error: problems.join(" ") }, { status: 422 });

      const r = report.data;
      recordEdit(r, data, { at: new Date().toISOString(), by: user.name, viaTask: task.id, changes });
      r.timeline = [...r.timeline, { at: new Date().toISOString(), actor: user.name, action: `Report details edited via task ${task.id}`, detail: describeChanges(changes) }];
      await putReport(r, `chore(report): ${task.id} edits ${changes.length} answer(s) on ${r.id}`, author, report.sha);
      if (task.status === "open" || task.status === "rejected") task.status = "in_progress";
      message = `chore(task): report edited through ${task.id}`;
      break;
    }

    /* Change who holds the task, when it is due, or what it says. */
    case "edit": {
      if (!isReviewer) return NextResponse.json({ error: "Only the person who raised the task, or the report's investigator, can change it." }, { status: 403 });
      const changes: string[] = [];
      const errors: string[] = [];
      const today = new Date().toISOString().slice(0, 10);

      if (typeof body.title === "string" && body.title.trim() && body.title.trim() !== task.title) {
        if (body.title.trim().length > 120) errors.push("Keep the title under 120 characters.");
        else {
          changes.push(`title to "${body.title.trim()}"`);
          task.title = body.title.trim();
        }
      }
      if (typeof body.description === "string" && body.description.trim() && body.description.trim() !== task.description) {
        changes.push("instructions updated");
        task.description = body.description.trim();
      }
      if (typeof body.priority === "string" && body.priority !== task.priority) {
        if (!["Low", "Medium", "High"].includes(body.priority)) errors.push("Priority is Low, Medium or High.");
        else {
          changes.push(`priority to ${body.priority}`);
          task.priority = body.priority as Task["priority"];
        }
      }
      if (typeof body.dueDate === "string" && body.dueDate !== task.dueDate) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate)) errors.push("Give the due date as a date.");
        else if (body.dueDate < today) errors.push("The due date cannot be in the past.");
        else {
          changes.push(`due ${body.dueDate}`);
          task.dueDate = body.dueDate;
          task.extensionRequested = undefined;
        }
      }
      let handedOver = "";
      if (typeof body.assignee === "string" && body.assignee && body.assignee !== task.assignee) {
        const person = staffDirectory(user).find((p) => p.email === body.assignee);
        if (!person) errors.push("Pick the new assignee from the staff directory.");
        else {
          handedOver = task.assignee;
          task.assignee = person.email;
          task.assigneeName = person.name;
          task.status = task.status === "submitted" ? "open" : task.status;
          changes.push(`assigned to ${person.name}`);
        }
      }
      if (errors.length) return NextResponse.json({ error: errors.join(" ") }, { status: 422 });
      if (!changes.length) return NextResponse.json({ error: "Nothing changed." }, { status: 422 });

      message = `chore(task): edit ${task.id}`;
      await logOnReport(task, user.name, "Task changed", `${task.id}: ${changes.join(", ")}`, author);
      if (handedOver) {
        await notify({
          to: task.assignee,
          subject: `Task assigned to you: ${task.title}`,
          body: `${user.name} has handed you a task on a ${task.reportType}, due ${task.dueDate}.`,
          link: `${req.nextUrl.origin}/tasks#${task.id}`
        });
        await notify({ to: handedOver, subject: `Task reassigned: ${task.title}`, body: `${user.name} has passed this task to someone else.`, link });
      } else {
        await notify({ to: task.assignee, subject: `Task changed: ${task.title}`, body: changes.join(", "), link: `${req.nextUrl.origin}/tasks#${task.id}` });
      }
      break;
    }

    /* Accept, or send back with a reason (US-08 criterion 14). */
    case "review": {
      if (!isReviewer) return NextResponse.json({ error: "Only the person who raised the task, or the report's investigator, can review it." }, { status: 403 });
      if (task.status !== "submitted") return NextResponse.json({ error: "The assignee has not marked this task complete yet." }, { status: 409 });
      const comment = String(body.comment ?? "").trim();
      const accept = body.decision === "accept";
      if (!accept && !comment) return NextResponse.json({ error: "Say what still needs doing before sending the task back." }, { status: 422 });
      task.status = accept ? "accepted" : "rejected";
      task.reviewComment = comment || undefined;
      message = `chore(task): ${accept ? "accept" : "send back"} ${task.id}`;
      await logOnReport(task, user.name, accept ? "Task accepted" : "Task sent back", `${task.id}${comment ? `: ${comment}` : ""}`, author);
      await notify({
        to: task.assignee,
        subject: `Task ${accept ? "accepted" : "sent back"}: ${task.title}`,
        body: comment,
        link: `${req.nextUrl.origin}/tasks#${task.id}`
      });
      break;
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }

  await putTask(task, message, author, loaded.sha);
  return NextResponse.json(task);
}

/**
 * Delete a task (US-08). It leaves every list and stops holding up its stage; the task itself is
 * kept, marked cancelled, and the report's timeline says who deleted it and why.
 */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const loaded = await getTask(params.id);
  if (!loaded) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const task = loaded.data;
  const report = await getReport(task.reportId);
  const isReviewer =
    task.createdBy === user.email ||
    report?.data.triage?.investigator === user.email ||
    ["admin", "system_admin"].includes(user.role);
  if (!isReviewer) return NextResponse.json({ error: "Only the person who raised the task, or the report's investigator, can delete it." }, { status: 403 });
  if (!isTaskEditable(task.status)) {
    return NextResponse.json({ error: "This task has been accepted. Accepted work is kept, not deleted." }, { status: 409 });
  }

  const reason = String(((await req.json().catch(() => ({}))) as { reason?: string }).reason ?? "").trim();
  const author = commitAuthor(user);
  task.status = "cancelled";
  task.cancelled = { by: user.name, at: new Date().toISOString(), reason: reason || undefined };
  await putTask(task, `chore(task): delete ${task.id}`, author, loaded.sha);
  await removeTaskFromIndex(task.id, author);
  await logOnReport(task, user.name, "Task deleted", `${task.id}: ${task.title}${reason ? ` - ${reason}` : ""}`, author, (r) => {
    r.tasks = r.tasks.filter((id) => id !== task.id);
  });
  await notify({
    to: task.assignee,
    subject: `Task withdrawn: ${task.title}`,
    body: `${user.name} has withdrawn this task.${reason ? ` ${reason}` : ""}`,
    link: `${req.nextUrl.origin}/tasks`
  });
  return NextResponse.json({ deleted: task.id });
}

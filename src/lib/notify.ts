/**
 * Email and in-app notification (BRD feature 11).
 *
 * Task notifications deliberately carry the report *type* and never the full Report ID, and
 * never the narrative - that privacy rule lives here so it cannot be bypassed by a caller.
 */
import { createNotification } from "./store/notifications";

export interface Notification {
  to: string;
  subject: string;
  body: string;
  link: string;
}

export async function notify(n: Notification, type: "task_assigned" | "report_assigned" | "status_change" | "approval_request" | "task_completed" = "task_assigned"): Promise<void> {
  // Create in-app notification
  await createNotification({
    userId: n.to,
    type,
    title: n.subject,
    message: n.body,
    link: n.link
  }).catch(err => console.error("Failed to create in-app notification:", err));

  // Send email if configured
  const smtp = process.env.SMTP_URL;
  if (!smtp) {
    console.log(`[notify] to=${n.to} subject=${n.subject}\n${n.body}\n${n.link}`);
    return;
  }
  // Wire nodemailer or Resend here. Kept out of the prototype so there is no mail dependency.
  console.log(`[notify] would send via ${smtp.split("@").pop()} to ${n.to}`);
}

export function taskNotification(params: {
  to: string;
  reportType: string;
  title: string;
  dueDate: string;
  assignedBy: string;
  taskId: string;
  baseUrl: string;
}): Notification {
  return {
    to: params.to,
    subject: `Safety task assigned: ${params.title}`,
    body: [
      `${params.assignedBy} has assigned you a task on a ${params.reportType}.`,
      ``,
      `Task: ${params.title}`,
      `Due: ${params.dueDate}`,
      ``,
      `Open the task to respond. You will see the task and its attachments; the report itself stays closed unless edit access was granted to you.`
    ].join("\n"),
    link: `${params.baseUrl}/tasks#${params.taskId}`
  };
}

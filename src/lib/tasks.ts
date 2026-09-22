import type { TaskType } from "./types";

/**
 * The four purposes a task can be raised for, in the BRD's order (section 3.4, US-08 criterion 1).
 * Shared by the task form in the browser and the task API on the server.
 */
export interface TaskTypeDef {
  type: TaskType;
  label: string;
  description: string;
  /** Who can be assigned: the report's own reporter, or anyone in the staff directory. */
  assignee: "reporter" | "anyone";
  /** Whether form edit access can be granted, and whether it starts switched on. */
  formEdit: "none" | "optional" | "default";
  /** An action task can point at the SRA control it implements. */
  control: boolean;
  defaultTitle: string;
}

export const TASK_TYPES: TaskTypeDef[] = [
  {
    type: "reporter_info",
    label: "More information from the reporter",
    description: "Ask the person who filed the report a question. They can be given edit access to correct their own answers.",
    assignee: "reporter",
    formEdit: "optional",
    control: false,
    defaultTitle: "More information needed on your report"
  },
  {
    type: "form_edit",
    label: "Information by editing the form",
    description: "Ask someone, usually the SMS Nodal, to fill in or correct chosen sections of the report, or to answer in the description box.",
    assignee: "anyone",
    formEdit: "default",
    control: false,
    defaultTitle: "Complete sections of the report"
  },
  {
    type: "company_info",
    label: "Information from anyone in the company",
    description: "Ask anyone in the organisation for information. They see the task only, not the report.",
    assignee: "anyone",
    formEdit: "optional",
    control: false,
    defaultTitle: "Information request"
  },
  {
    type: "action",
    label: "Control or action",
    description: "Give someone a control to put in place or an action to carry out, with evidence when it is done.",
    assignee: "anyone",
    formEdit: "none",
    control: true,
    defaultTitle: "Action required"
  }
];

export function taskType(type: TaskType | undefined): TaskTypeDef | undefined {
  return TASK_TYPES.find((t) => t.type === type);
}

export function taskTypeLabel(type: TaskType | undefined): string {
  return taskType(type)?.label ?? "Task";
}

export const TASK_STATUS_LABEL: Record<string, string> = {
  open: "Open",
  in_progress: "In progress",
  submitted: "Awaiting review",
  accepted: "Accepted",
  rejected: "Sent back",
  cancelled: "Deleted"
};

/** A task still holds up its stage and closure until whoever raised it accepts the work. */
export const isTaskOpen = (status: string) => status !== "accepted" && status !== "cancelled";

/** A task can still be changed or deleted until the work on it has been accepted. */
export const isTaskEditable = (status: string) => status !== "accepted" && status !== "cancelled";

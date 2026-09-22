export type Role = "reporter" | "admin" | "gatekeeper" | "investigator" | "system_admin" | "cofs";

export type ReportStatus =
  | "draft"
  | "new"
  | "rejected"
  | "in_progress"
  | "pending_risk_approval"
  | "pending_gatekeeper_approval"
  | "pending_cofs_approval"
  | "effectiveness_review"
  | "closed";

export type AcceptanceType = "investigation_sra" | "sra_only" | "database_only";

export interface Person {
  name: string;
  email: string;
  staffNo: string;
  department: string;
  base?: string;
}

/** Someone a gatekeeper can hand a report to at triage. */
export interface Assignee {
  name: string;
  email: string;
  role: Role;
  department: string;
  scope: "all" | "department";
}

export interface FormMeta {
  formId: string;
  code: string;
  title: string;
  summary: string;
  supportsConfidential: boolean;
  attachmentsRequired: boolean;
  /** Departments that see the form. "*" means all staff. */
  departments?: string[];
  gatekeeperGroup?: string;
  status?: "active" | "retired";
  version?: number;
  updatedAt?: string;
  updatedBy?: string;
}

/** A report form: JSON Schema plus an RJSF uiSchema. See config/forms/README.md. */
export interface FormDef {
  meta: FormMeta;
  schema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
}

export interface StageTemplate {
  key: string;
  name: string;
  taskDays: number;
}

export interface WorkflowTemplates {
  default: StageTemplate[];
  byFormId: Record<string, StageTemplate[]>;
}

export interface TimelineEntry {
  at: string;
  actor: string;
  action: string;
  detail?: string;
}

export interface WorkflowStage {
  key: string;
  name: string;
  status: "not_started" | "in_progress" | "complete";
  owner?: string;
  taskDays: number;
  targetDate: string;
  response?: string;
  completedAt?: string;
}

export interface Control {
  id: string;
  text: string;
  kind: "existing" | "additional";
  monitoringPeriod?: string;
  reviewDate?: string;
  reviewOutcome?: "Effective" | "Ineffective" | "Partially Effective";
  effectiveness?: string;
  actionPlan?: string;
}

/** BRD 7 fields 8 to 13 and 15: one hazard of an assessment, with the controls next to it. */
export interface Hazard {
  id: string;
  hazard: string;
  description?: string;
  rootCause?: string;
  resultantRisk?: string;
  worstCredibleEffect?: string;
  controls: Control[];
  /** Risk ratings used to live on the hazard. Kept so assessments saved then still load. */
  preMitigation?: string;
  postMitigation?: string;
}

export type SraStatus = "Open" | "In Progress" | "Closed";

/**
 * One safety risk assessment (BRD 7). The risk index, the action that follows from it and the
 * review of that action belong to the assessment as a whole; hazards and their controls are the
 * repeating part inside it.
 */
export interface Sra {
  id: string;
  /** The finding that called for this assessment (BRD 9: one SRA tab per flagged finding). */
  findingRef?: string;
  title: string;
  /** Position in the report's hazard register, stamped on save. */
  serial?: number;
  /** The reporter's name, or "Confidential". Stamped on save, never typed. */
  originator?: string;
  source?: string;
  location?: string;
  functionalArea?: string;
  subFunction?: string;
  dateAddedToRegister?: string;
  hazards: Hazard[];
  preMitigation?: string;
  postMitigation?: string;
  /** Set when the investigator confirmed a rare post-mitigation severity reduction. */
  severityOverrideAccepted?: boolean;
  action?: string;
  owner?: string;
  ownerName?: string;
  department?: string;
  subDepartment?: string;
  deadline?: string;
  status?: SraStatus;
  /** Only once the action is closed (BRD 7 fields 21 to 24). */
  reviewPeriod?: string;
  reviewDate?: string;
  effectiveness?: string;
  actionPlan?: string;
  approval?: {
    required: boolean;
    approver?: string;
    status: "not_required" | "pending" | "approved" | "rejected";
    comment?: string;
    decidedAt?: string;
  };
}

export interface Finding {
  id: string;
  text: string;
  state?: string;
  rootCause?: string;
  actions?: string;
  sraRequired: boolean;
}

export interface Investigation {
  synopsis?: string;
  factual?: Record<string, string>;
  analysis?: string;
  recommendations?: string;
  findings: Finding[];
  updatedAt?: string;
}

/** The four purposes a task can be raised for (BRD 3.4, US-08 criterion 1). */
export type TaskType = "reporter_info" | "form_edit" | "company_info" | "action";

export interface TaskComment {
  at: string;
  by: string;
  byEmail: string;
  text: string;
}

export interface Task {
  id: string;
  reportId: string;
  reportType: string;
  /** Absent on tasks raised before task types existed. */
  type?: TaskType;
  /** The workflow stage the task belongs to; its open tasks block that stage from completing. */
  stageKey?: string;
  /** For an action task: the SRA control it implements. */
  controlId?: string;
  title: string;
  description: string;
  assignee: string;
  assigneeName?: string;
  priority: "Low" | "Medium" | "High";
  dueDate: string;
  formEditAccess: boolean;
  editableSections: string[];
  status: "open" | "in_progress" | "submitted" | "accepted" | "rejected" | "cancelled";
  response?: string;
  /** Set when the task was deleted: it leaves every list, and the report's timeline says why. */
  cancelled?: { by: string; at: string; reason?: string };
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  extensionRequested?: string;
  reviewComment?: string;
  comments?: TaskComment[];
}

/** One save of a submitted report's answers: who, when, and every field that changed. */
export interface ReportEdit {
  at: string;
  by: string;
  /** Set when the edit came from a task assignee using granted edit access. */
  viaTask?: string;
  changes: { field: string; label: string; from: unknown; to: unknown }[];
}

export interface CaeData {
  fetchedAt?: string;
  source: "cae" | "manual" | "unavailable";
  crew?: { name: string; role: string; licence: string; base: string }[];
  aircraft?: { type: string; registration: string; configuration: string };
  error?: string;
}

export interface Report {
  id: string;
  safetyRef?: string;
  formId: string;
  formTitle: string;
  /** The form version the report was filed on. Absent on reports filed before versioning. */
  formVersion?: number;
  status: ReportStatus;
  confidential: boolean;
  submittedBy?: Person;
  submittedAt: string;
  data: Record<string, unknown>;
  /** The reporter's answers as submitted, kept from the first edit onwards (US-04). */
  originalData?: Record<string, unknown>;
  edits?: ReportEdit[];
  attachments: { name: string; size: number; url?: string }[];
  gatekeeperGroup: string;
  triage?: {
    decision: AcceptanceType | "reject";
    operationalHazard?: boolean;
    comment?: string;
    by: string;
    at: string;
    investigator?: string;
  };
  cae?: CaeData;
  investigation?: Investigation;
  sras: Sra[];
  workflow: WorkflowStage[];
  tasks: string[];
  closure?: {
    submittedBy?: string;
    submittedAt?: string;
    signOff?: string;
    followUp?: string;
    gatekeeper?: { decision: "approved" | "rejected"; by: string; at: string; comment?: string };
    cofs?: { decision: "approved" | "rejected"; by: string; at: string; comment?: string };
    closedAt?: string;
  };
  timeline: TimelineEntry[];
}

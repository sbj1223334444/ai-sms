import wf from "../../config/workflows.json";
import { normaliseSra, sraClosureBlockers } from "./sra";
import type { Report, StageTemplate, WorkflowStage, WorkflowTemplates } from "./types";

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The shipped templates. Admins override them from Administration → Workflows (US-18). */
export const SHIPPED_TEMPLATES: WorkflowTemplates = {
  default: wf.default,
  byFormId: wf.byFormId as Record<string, StageTemplate[]>
};

/** Triage completes the first stage and closure approval completes the last, so both stay put. */
export const FIRST_STAGE = "report-review";
export const LAST_STAGE = "closure";

export function templateFor(formId: string, templates: WorkflowTemplates = SHIPPED_TEMPLATES): StageTemplate[] {
  return templates.byFormId[formId] ?? templates.default;
}

/** A new report's stages, from its type's template, with target dates chained from submission. */
export function buildWorkflow(formId: string, raisedAt: string, templates: WorkflowTemplates = SHIPPED_TEMPLATES): WorkflowStage[] {
  const stages = templateFor(formId, templates);
  let cursor = raisedAt;
  return stages.map((s, i) => {
    const targetDate = addDays(cursor, s.taskDays);
    cursor = targetDate;
    return {
      key: s.key,
      name: s.name,
      status: i === 0 ? "in_progress" : "not_started",
      taskDays: s.taskDays,
      targetDate
    };
  });
}

export function advance(stages: WorkflowStage[], key: string, owner: string): WorkflowStage[] {
  const i = stages.findIndex((s) => s.key === key);
  if (i === -1) return stages;
  const next = stages.map((s) => ({ ...s }));
  next[i].status = "complete";
  next[i].completedAt = new Date().toISOString();
  next[i].owner = next[i].owner ?? owner;
  if (next[i + 1]) next[i + 1].status = "in_progress";
  return next;
}

/**
 * Reopen a completed stage. Work is never lost: the stage goes back in progress with whatever was
 * written at it, and because the workflow runs in order, every stage after it starts again too.
 */
export function reopenStage(
  stages: WorkflowStage[],
  key: string
): { ok: true; stages: WorkflowStage[]; reopened: WorkflowStage; alsoReset: string[] } | { ok: false; error: string } {
  const i = stages.findIndex((s) => s.key === key);
  if (i === -1) return { ok: false, error: "That stage is not on this report. Reload and try again." };
  if (stages[i].status !== "complete") return { ok: false, error: `"${stages[i].name}" is not complete, so there is nothing to reopen.` };
  if (key === LAST_STAGE) return { ok: false, error: "Closure Approval is reopened by an approver sending the report back, not from here." };

  const alsoReset: string[] = [];
  const next = stages.map((s, j) => {
    if (j < i) return { ...s };
    if (j === i) return { ...s, status: "in_progress" as const, completedAt: undefined };
    if (s.status !== "not_started") alsoReset.push(s.name);
    return { ...s, status: "not_started" as const, completedAt: undefined };
  });
  return { ok: true, stages: next, reopened: next[i], alsoReset };
}

/* ---------------- Editing stages (US-18, US-19) ---------------- */

/** A stable key for a new stage, derived from its name and unique among the keys given. */
export function stageKeyFor(name: string, taken: Iterable<string>): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "stage";
  const used = new Set(taken);
  let key = base;
  for (let n = 2; used.has(key); n++) key = `${base}-${n}`;
  return key;
}

function stageProblems(stages: { name: string; taskDays: number }[]): string[] {
  const errors: string[] = [];
  stages.forEach((s, i) => {
    const label = s.name?.trim() || `Stage ${i + 1}`;
    if (!s.name?.trim()) errors.push(`Stage ${i + 1} needs a name.`);
    else if (s.name.trim().length > 80) errors.push(`"${label}": keep stage names under 80 characters.`);
    if (!Number.isInteger(s.taskDays) || s.taskDays < 1 || s.taskDays > 365) errors.push(`"${label}": target days must be a whole number from 1 to 365.`);
  });
  return errors;
}

/**
 * Check a template and give new stages their keys. Report Review must stay first and Closure
 * Approval last; everything between is free.
 */
export function normaliseTemplate(stages: StageTemplate[]): { ok: true; stages: StageTemplate[] } | { ok: false; errors: string[] } {
  const errors = stageProblems(stages);
  if (stages[0]?.key !== FIRST_STAGE) errors.push("Report Review must stay the first stage.");
  if (stages[stages.length - 1]?.key !== LAST_STAGE || stages.length < 2) errors.push("Closure Approval must stay the last stage.");
  const keys = stages.map((s) => s.key).filter(Boolean);
  if (new Set(keys).size !== keys.length) errors.push("Two stages share the same key.");
  if (errors.length) return { ok: false, errors };

  const taken = new Set(keys);
  const out = stages.map((s) => {
    const key = s.key || stageKeyFor(s.name, taken);
    taken.add(key);
    return { key, name: s.name.trim(), taskDays: s.taskDays };
  });
  return { ok: true, stages: out };
}

/** Stages on a live report that cannot be edited, moved or removed, and why. */
export function lockedReason(stage: WorkflowStage): string | null {
  if (stage.status === "complete") return "Complete";
  if (stage.status === "in_progress") return "In progress";
  if (stage.key === LAST_STAGE) return "Always last";
  return null;
}

/**
 * Apply an edited stage list to a report under investigation (US-19).
 *
 * `proposed` is the whole list in its new order. Locked stages (complete, in progress, Closure
 * Approval) must come through unchanged and in place; stages not started may be renamed,
 * re-timed, removed or reordered; entries with no known key are new stages. Target dates of every
 * stage after the one in progress are recalculated in order.
 */
export function applyStageEdits(
  current: WorkflowStage[],
  proposed: StageTemplate[]
): { ok: true; stages: WorkflowStage[]; changes: string[] } | { ok: false; error: string } {
  const pivot = current.reduce((last, s, i) => (s.status !== "not_started" ? i : last), -1);
  const closure = current[current.length - 1];
  if (!closure || closure.key !== LAST_STAGE) return { ok: false, error: "This report's workflow has no Closure Approval stage." };

  const head = current.slice(0, pivot + 1);
  for (let i = 0; i < head.length; i++) {
    const p = proposed[i];
    const s = head[i];
    if (!p || p.key !== s.key || p.name !== s.name || p.taskDays !== s.taskDays) {
      return { ok: false, error: `"${s.name}" is ${lockedReason(s)?.toLowerCase()} and cannot be changed, moved or removed.` };
    }
  }
  const last = proposed[proposed.length - 1];
  if (pivot === current.length - 1) return { ok: false, error: "Every stage has started. There is nothing left to change." };
  if (!last || last.key !== LAST_STAGE || last.name !== closure.name || last.taskDays !== closure.taskDays) {
    return { ok: false, error: `"${closure.name}" must stay the last stage, unchanged.` };
  }

  const middle = proposed.slice(head.length, -1);
  const problems = stageProblems(middle);
  if (problems.length) return { ok: false, error: problems[0] };

  const editable = new Map(current.slice(head.length, -1).map((s) => [s.key, s]));
  const used = new Set<string>();
  const taken = new Set(current.map((s) => s.key));
  const changes: string[] = [];
  const rebuilt: WorkflowStage[] = [];

  for (const p of middle) {
    const existing = p.key ? editable.get(p.key) : undefined;
    if (p.key && !existing && current.some((s) => s.key === p.key)) {
      return { ok: false, error: `"${p.name}" is locked and cannot be moved.` };
    }
    if (existing) {
      if (used.has(existing.key)) return { ok: false, error: `"${existing.name}" appears twice.` };
      used.add(existing.key);
      const name = p.name.trim();
      if (name !== existing.name) changes.push(`renamed "${existing.name}" to "${name}"`);
      if (p.taskDays !== existing.taskDays) changes.push(`"${name}" now ${p.taskDays} day${p.taskDays === 1 ? "" : "s"}`);
      rebuilt.push({ ...existing, name, taskDays: p.taskDays });
    } else {
      const key = stageKeyFor(p.name, taken);
      taken.add(key);
      changes.push(`added "${p.name.trim()}"`);
      rebuilt.push({ key, name: p.name.trim(), status: "not_started", taskDays: p.taskDays, targetDate: "" });
    }
  }

  for (const s of editable.values()) if (!used.has(s.key)) changes.push(`removed "${s.name}"`);
  const before = [...editable.keys()].filter((k) => used.has(k));
  const after = rebuilt.map((s) => s.key).filter((k) => editable.has(k));
  if (before.join() !== after.join()) {
    const moved = after.filter((k, i) => before[i] !== k).map((k) => `"${editable.get(k)!.name}"`);
    changes.push(`reordered ${moved.join(", ")}`);
  }
  if (!changes.length) return { ok: false, error: "Nothing changed." };

  let cursor = head.length ? head[head.length - 1].targetDate : new Date().toISOString();
  const tail = [...rebuilt, { ...closure }].map((s) => {
    const targetDate = addDays(cursor, s.taskDays);
    cursor = targetDate;
    return { ...s, targetDate };
  });
  return { ok: true, stages: [...head, ...tail], changes };
}

export interface Gate {
  ok: boolean;
  blockers: string[];
}

/** BRD 3.5 closure readiness. Every condition must hold before closure can be submitted. */
export function closureReadiness(report: Report, openTasks: number): Gate {
  const blockers: string[] = [];

  const incompleteStages = report.workflow.filter((s) => s.status !== "complete" && s.key !== "closure");
  if (incompleteStages.length) blockers.push(`${incompleteStages.length} workflow stage(s) not complete: ${incompleteStages.map((s) => s.name).join(", ")}`);
  if (openTasks > 0) blockers.push(`${openTasks} task(s) still open`);

  if (report.triage?.decision === "investigation_sra") {
    const inv = report.investigation;
    if (!inv?.synopsis) blockers.push("Investigation synopsis is empty");
    if (!inv?.analysis) blockers.push("Investigation analysis is empty");
    if (!inv?.recommendations) blockers.push("Safety recommendations are empty");
    if (!inv?.findings?.length) blockers.push("No findings recorded");
  }

  if (report.triage?.decision !== "database_only") {
    if (!report.sras.length) blockers.push("No safety risk assessment started");
    report.sras.forEach((sra, i) => blockers.push(...sraClosureBlockers(normaliseSra(sra, i))));
  }

  return { ok: blockers.length === 0, blockers };
}

export const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  new: "New",
  rejected: "Rejected",
  in_progress: "In progress",
  pending_risk_approval: "Risk acceptance",
  pending_gatekeeper_approval: "Pending approval",
  pending_cofs_approval: "Pending approval",
  effectiveness_review: "Effectiveness review",
  closed: "Closed"
};

import { readJson, writeJson, mutate, history, ConflictError, isDurable, driverName } from "./driver";
import type { Report, Task } from "@/lib/types";
import { LOCATION_FIELDS } from "@/lib/locations";

export { ConflictError, history, isDurable, driverName };

/** There is always a store now: GitHub when configured, in-memory otherwise. */
export function storeConfigured() {
  return true;
}

const P = {
  report: (id: string) => `data/reports/${id}.json`,
  task: (id: string) => `data/tasks/${id}.json`,
  index: "data/index.json",
  counters: "data/counters.json"
};

export interface IndexRow {
  id: string;
  safetyRef?: string;
  formId: string;
  formTitle: string;
  status: string;
  department?: string;
  station?: string;
  raisedBy: string;
  submittedAt: string;
  dueDate?: string;
  gatekeeperGroup: string;
  investigator?: string;
}

export interface Counters {
  report: number;
  safetyRef: number;
  task: number;
  hazard: number;
  control: number;
}

const ZERO: Counters = { report: 0, safetyRef: 0, task: 0, hazard: 0, control: 0 };

export async function nextId(kind: keyof Counters, actor: { name: string; email: string }): Promise<number> {
  const next = await mutate<Counters>(
    P.counters,
    ZERO,
    (c) => ({ ...ZERO, ...c, [kind]: (c[kind] || 0) + 1 }),
    `chore(counter): issue ${kind} id`,
    actor
  );
  return next[kind];
}

export async function getReport(id: string) {
  return readJson<Report>(P.report(id));
}

export async function putReport(
  report: Report,
  message: string,
  actor: { name: string; email: string },
  sha?: string
) {
  await writeJson(P.report(report.id), report, message, actor, sha);
  await mutate<IndexRow[]>(
    P.index,
    [],
    (rows) => {
      const row = indexRow(report);
      const i = rows.findIndex((r) => r.id === report.id);
      if (i === -1) return [row, ...rows];
      const copy = rows.slice();
      copy[i] = row;
      return copy;
    },
    `chore(index): ${report.id} -> ${report.status}`,
    actor
  );
}

export function indexRow(r: Report): IndexRow {
  const stage = r.workflow.find((s) => s.status !== "complete");
  return {
    id: r.id,
    safetyRef: r.safetyRef,
    formId: r.formId,
    formTitle: r.formTitle,
    status: r.status,
    department: r.confidential ? undefined : r.submittedBy?.department,
    station: LOCATION_FIELDS.map((k) => r.data[k]).find((v): v is string => typeof v === "string" && v !== ""),
    raisedBy: r.confidential ? "Confidential" : r.submittedBy?.name || "Unknown",
    submittedAt: r.submittedAt,
    dueDate: stage?.targetDate,
    gatekeeperGroup: r.gatekeeperGroup,
    investigator: r.triage?.investigator
  };
}

export async function listIndex(): Promise<IndexRow[]> {
  const loaded = await readJson<IndexRow[]>(P.index);
  return loaded?.data ?? [];
}

export async function getTask(id: string) {
  return readJson<Task>(P.task(id));
}

export async function putTask(task: Task, message: string, actor: { name: string; email: string }, sha?: string) {
  await writeJson(P.task(task.id), task, message, actor, sha);
}

export async function listTasks(): Promise<Task[]> {
  const idx = await readJson<string[]>("data/task-index.json");
  const ids = idx?.data ?? [];
  const tasks = await Promise.all(ids.map((id) => getTask(id)));
  return tasks.filter(Boolean).map((t) => t!.data);
}

export async function addTaskToIndex(id: string, actor: { name: string; email: string }) {
  await mutate<string[]>("data/task-index.json", [], (ids) => (ids.includes(id) ? ids : [id, ...ids]), `chore(index): task ${id}`, actor);
}

/** A deleted task leaves every listing. The task itself is kept, marked cancelled. */
export async function removeTaskFromIndex(id: string, actor: { name: string; email: string }) {
  await mutate<string[]>("data/task-index.json", [], (ids) => ids.filter((x) => x !== id), `chore(index): drop task ${id}`, actor);
}

export function reportHistory(id: string) {
  return history(P.report(id));
}

/* ---------- Configuration saved from the admin editors (US-16 to US-18) ---------- */

const CONFIG = {
  forms: "data/config/forms.json",
  workflows: "data/config/workflows.json"
} as const;

export type ConfigName = keyof typeof CONFIG;

/** Null until an admin saves something; callers fall back to the files in config/. */
export async function readConfig<T>(name: ConfigName): Promise<T | null> {
  const loaded = await readJson<T>(CONFIG[name]);
  return loaded?.data ?? null;
}

export async function updateConfig<T>(
  name: ConfigName,
  fallback: T,
  update: (current: T) => T,
  message: string,
  actor: { name: string; email: string }
): Promise<T> {
  return mutate<T>(CONFIG[name], fallback, update, message, actor);
}

export function configHistory(name: ConfigName) {
  return history(CONFIG[name]);
}

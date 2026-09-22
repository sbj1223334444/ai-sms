/**
 * Editing a submitted report (US-04 criteria 3, 12, 13; US-08 criterion 13).
 *
 * Investigators correct what the reporter entered; task assignees with granted edit access fill in
 * the sections they were given. Either way every changed field is recorded with its old and new
 * value, and the reporter's original answers are kept.
 *
 * Never editable: the reporter's identity (name, email, staff number, department), which is not in
 * the answers at all but stamped from SSO, and the confidentiality choice, because identity was
 * already dropped (or kept) on the strength of it at submission.
 */
import type { FormDef, Report, ReportEdit } from "./types";

export const LOCKED_FIELDS = ["confidential"];

type Json = Record<string, unknown>;

export interface EditableSection {
  key: string;
  label: string;
  /** The questions the section holds, in the order the form asks them. */
  fields: string[];
}

const sectionKey = (title: string, i: number) =>
  `s-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || `section-${i + 1}`}`;

/**
 * A form's sections, as offered for task edit access (US-08 criterion 4). These are the numbered
 * cards the reporter filled in - "Section C: Own aircraft" - not individual questions, so an
 * assignee is given a part of the form to complete rather than the whole of it. A form with no
 * sections declared falls back to one entry per question.
 */
export function editableSections(def: Pick<FormDef, "schema" | "uiSchema">): EditableSection[] {
  const props = (def.schema.properties ?? {}) as Record<string, Json>;
  const known = (k: string) => k in props && !LOCKED_FIELDS.includes(k);
  const groups = ((def.uiSchema?.["ui:groups"] as { title: string; fields?: string[] }[] | undefined) ?? []).filter(
    (g) => (g.fields ?? []).some(known)
  );
  if (groups.length) {
    const placed = new Set(groups.flatMap((g) => g.fields ?? []));
    const rest = Object.keys(props).filter((k) => known(k) && !placed.has(k));
    const sections = groups.map((g, i) => ({
      key: sectionKey(g.title, i),
      label: g.title,
      fields: (g.fields ?? []).filter(known)
    }));
    if (rest.length) sections.push({ key: "s-other", label: "Other questions", fields: rest });
    return sections;
  }
  return Object.entries(props)
    .filter(([key]) => known(key))
    .map(([key, s]) => ({ key, label: typeof s.title === "string" ? s.title : key, fields: [key] }));
}

/**
 * The questions the keys on a task stand for. Keys are section keys; tasks raised before sections
 * existed hold question keys, which still resolve to themselves.
 */
export function sectionFields(def: Pick<FormDef, "schema" | "uiSchema">, keys: string[]): string[] {
  const sections = new Map(editableSections(def).map((s) => [s.key, s.fields]));
  const props = (def.schema.properties ?? {}) as Json;
  const out: string[] = [];
  for (const key of keys) {
    for (const field of sections.get(key) ?? (key in props ? [key] : [])) {
      if (!out.includes(field) && !LOCKED_FIELDS.includes(field)) out.push(field);
    }
  }
  return out;
}

/** The part of a form a task assignee may edit: only the sections named on the task. */
export function sectionForm(def: Pick<FormDef, "schema" | "uiSchema">, keys: string[]): { schema: Json; uiSchema: Json } {
  const props = (def.schema.properties ?? {}) as Json;
  const allowed = sectionFields(def, keys);
  const groups = ((def.uiSchema?.["ui:groups"] as { title: string; fields?: string[] }[] | undefined) ?? [])
    .map((g) => ({ ...g, fields: (g.fields ?? []).filter((k) => allowed.includes(k)) }))
    .filter((g) => g.fields.length);
  const uiSchema: Json = Object.fromEntries(allowed.filter((k) => k in def.uiSchema).map((k) => [k, def.uiSchema[k]]));
  if (groups.length) uiSchema["ui:groups"] = groups;
  return {
    schema: {
      type: "object",
      required: ((def.schema.required as string[] | undefined) ?? []).filter((k) => allowed.includes(k)),
      properties: Object.fromEntries(allowed.map((k) => [k, props[k]]))
    },
    uiSchema
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const blank = (v: unknown) =>
  v === undefined ||
  v === null ||
  v === "" ||
  (Array.isArray(v) && v.length === 0) ||
  (typeof v === "object" && !Array.isArray(v) && Object.keys(v as object).length === 0);

/**
 * Work out the next answers and what changed. `allowed` limits the edit to those keys (a task
 * assignee); without it every answer except the locked ones may change (an investigator).
 *
 * An answer missing from `incoming` is left as it is. To clear one, send it as null (see
 * withClears), so a partial request can never wipe answers by accident.
 */
export function diffAnswers(
  current: Json,
  incoming: Json,
  labels: Record<string, string>,
  allowed?: string[]
): { data: Json; changes: ReportEdit["changes"] } {
  const keys = allowed ?? [...new Set([...Object.keys(current), ...Object.keys(incoming)])];
  const data: Json = { ...current };
  const changes: ReportEdit["changes"] = [];
  for (const key of keys) {
    if (LOCKED_FIELDS.includes(key) || !(key in incoming)) continue;
    const from = current[key];
    const to = incoming[key];
    if (same(from, to) || (blank(from) && blank(to))) continue;
    if (blank(to)) delete data[key];
    else data[key] = to;
    changes.push({ field: key, label: labels[key] ?? key, from, to });
  }
  return { data, changes };
}

/**
 * What a form editor sends: the form's answers, with every answer the user emptied sent as null.
 * The form library drops emptied fields entirely, which would otherwise read as "unchanged".
 */
export function withClears(before: Json, after: Json): Json {
  const out: Json = {};
  for (const key of Object.keys(before)) out[key] = null;
  for (const [key, value] of Object.entries(after)) out[key] = value === undefined ? null : value;
  return out;
}

/** Every question's label, including ones that only appear after an earlier answer. */
export function fieldLabels(def: Pick<FormDef, "schema"> | null): Record<string, string> {
  const labels: Record<string, string> = {};
  const take = (props: unknown) => {
    for (const [k, s] of Object.entries((props ?? {}) as Record<string, Json>)) {
      if (typeof s?.title === "string" && !labels[k]) labels[k] = s.title;
    }
  };
  take(def?.schema.properties);
  for (const dep of Object.values((def?.schema.dependencies ?? {}) as Record<string, Json>)) {
    for (const branch of (dep.oneOf as Json[] | undefined) ?? []) take(branch.properties);
  }
  return labels;
}

/** The form's sections with the answers given in each, for read-only display. */
export function answersBySection(
  def: Pick<FormDef, "schema" | "uiSchema"> | null,
  data: Json
): { title: string; rows: { key: string; label: string; value: unknown }[] }[] {
  const labels = fieldLabels(def);
  const groups = ((def?.uiSchema["ui:groups"] as { title: string; fields?: string[] }[] | undefined) ?? []).filter((g) => g.fields?.length);
  const answered = (k: string) => !blank(data[k]);
  const used = new Set<string>();
  const sections = groups
    .map((g) => ({
      title: g.title,
      rows: (g.fields ?? []).filter(answered).map((k) => {
        used.add(k);
        return { key: k, label: labels[k] ?? k, value: data[k] };
      })
    }))
    .filter((s) => s.rows.length);
  const rest = Object.keys(data).filter((k) => !used.has(k) && answered(k));
  if (rest.length) {
    sections.push({ title: groups.length ? "Other answers" : "Answers", rows: rest.map((k) => ({ key: k, label: labels[k] ?? k.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), value: data[k] })) });
  }
  return sections;
}

function show(v: unknown): string {
  if (blank(v)) return "blank";
  const text = Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${text.length > 60 ? `${text.slice(0, 57)}...` : text}"`;
}

/** One line per change, for the timeline. */
export function describeChanges(changes: ReportEdit["changes"]): string {
  return changes.map((c) => `${c.label}: ${show(c.from)} to ${show(c.to)}`).join("; ");
}

/** Apply an edit to a report in place: keep the original answers, record the edit. */
export function recordEdit(report: Report, data: Json, edit: ReportEdit) {
  if (!report.originalData) report.originalData = report.data;
  report.data = data;
  report.edits = [...(report.edits ?? []), edit];
}

/** US-04 criterion 3: read and write for Investigation + SRA, read-only otherwise, and only while open. */
export function reportEditable(report: Report): boolean {
  return report.triage?.decision === "investigation_sra" && ["in_progress", "pending_risk_approval"].includes(report.status);
}

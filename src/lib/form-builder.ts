/**
 * The form editor's model of a form, and the conversion between it and JSON Schema + uiSchema.
 *
 * Conversion is a patch, not a rebuild. Each field keeps the schema and uiSchema it was loaded
 * with, and saving writes back only the attributes that were actually changed. A form opened and
 * saved untouched comes back identical, including everything the editor knows nothing about:
 * conditional branches, ui:order, defaults, patterns. Fields the editor cannot represent are
 * carried through as "advanced".
 *
 * Shared by the editor in the browser and the admin API on the server.
 */
import type { FormDef, FormMeta } from "./types";

type Json = Record<string, unknown>;

export type FieldType = "text" | "textarea" | "number" | "integer" | "date" | "time" | "select" | "radio" | "checkboxes";

export const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: "text", label: "Short text" },
  { type: "textarea", label: "Long text" },
  { type: "number", label: "Number" },
  { type: "integer", label: "Whole number" },
  { type: "date", label: "Date" },
  { type: "time", label: "Time (HH:MM)" },
  { type: "select", label: "Dropdown" },
  { type: "radio", label: "Single choice buttons" },
  { type: "checkboxes", label: "Multiple choice" }
];

export const TIME_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]$";

/** The field the app reads to decide whether a report is confidential (see api/reports). */
export const CONFIDENTIAL_KEY = "confidential";

export interface BuilderField {
  key: string;
  label: string;
  /** "advanced": a shape the builder does not edit, such as a repeating section. */
  type: FieldType | "advanced";
  required: boolean;
  help: string;
  options: string[];
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  /** The field's schema and uiSchema as loaded. Saving patches these. */
  schema: Json;
  ui?: Json;
  /** Where loaded help text lived, so an edit is written back to the same place. */
  helpIn: "ui" | "schema";
  /** Not saved yet, so its key can still change. */
  isNew?: boolean;
}

export function isChoice(type: BuilderField["type"]): boolean {
  return type === "select" || type === "radio" || type === "checkboxes";
}

export function typeLabel(type: BuilderField["type"]): string {
  return FIELD_TYPES.find((t) => t.type === type)?.label ?? "Advanced";
}

function detectType(schema: Json, ui?: Json): BuilderField["type"] {
  const widget = ui?.["ui:widget"];
  if (schema.type === "string") {
    if (Array.isArray(schema.enum)) return widget === "radio" ? "radio" : "select";
    if (schema.format === "date") return "date";
    if (schema.pattern === TIME_PATTERN) return "time";
    return widget === "textarea" ? "textarea" : "text";
  }
  if (schema.type === "number") return "number";
  if (schema.type === "integer") return "integer";
  if (schema.type === "array") {
    const items = schema.items as Json | undefined;
    if (items?.type === "string" && Array.isArray(items.enum) && widget === "checkboxes") return "checkboxes";
  }
  return "advanced";
}

const num = (v: unknown) => (typeof v === "number" ? v : undefined);

function readField(key: string, schema: Json, ui: Json | undefined, required: boolean): BuilderField {
  const type = detectType(schema, ui);
  const uiHelp = typeof ui?.["ui:help"] === "string" ? (ui["ui:help"] as string) : undefined;
  const schemaHelp = typeof schema.description === "string" ? schema.description : undefined;
  const enumSource = type === "checkboxes" ? (schema.items as Json).enum : schema.enum;
  return {
    key,
    label: typeof schema.title === "string" ? schema.title : key,
    type,
    required,
    help: uiHelp ?? schemaHelp ?? "",
    helpIn: uiHelp === undefined && schemaHelp !== undefined ? "schema" : "ui",
    options: Array.isArray(enumSource) ? enumSource.map(String) : [],
    maxLength: num(schema.maxLength),
    minimum: num(schema.minimum),
    maximum: num(schema.maximum),
    schema,
    ui
  };
}

/** Top-level properties as editor fields, in display order (ui:order when the form has one). */
export function formToFields(def: Pick<FormDef, "schema" | "uiSchema">): BuilderField[] {
  const props = (def.schema.properties ?? {}) as Record<string, Json>;
  const required = new Set((def.schema.required as string[] | undefined) ?? []);
  const fields = Object.entries(props).map(([key, schema]) =>
    readField(key, schema, def.uiSchema[key] as Json | undefined, required.has(key))
  );
  const groups = def.uiSchema["ui:groups"] as FormSection[] | undefined;
  const order = Array.isArray(groups) ? groups.flatMap((g) => g.fields ?? []) : def.uiSchema["ui:order"];
  if (!Array.isArray(order)) return fields;
  const star = order.indexOf("*");
  const pos = (k: string) => (order.includes(k) ? order.indexOf(k) : star === -1 ? order.length : star);
  return fields.map((f, i) => ({ f, i })).sort((a, b) => pos(a.f.key) - pos(b.f.key) || a.i - b.i).map((x) => x.f);
}

function freshField(f: BuilderField): { schema: Json; ui?: Json } {
  const schema: Json = {};
  const ui: Json = {};
  const opts = f.options.map((o) => o.trim()).filter(Boolean);
  switch (f.type) {
    case "text":
    case "textarea":
      Object.assign(schema, { type: "string", title: f.label });
      if (f.maxLength) schema.maxLength = f.maxLength;
      if (f.type === "textarea") Object.assign(ui, { "ui:widget": "textarea", "ui:options": { rows: 4 } });
      break;
    case "number":
    case "integer":
      Object.assign(schema, { type: f.type, title: f.label });
      if (f.minimum !== undefined) schema.minimum = f.minimum;
      if (f.maximum !== undefined) schema.maximum = f.maximum;
      break;
    case "date":
      Object.assign(schema, { type: "string", format: "date", title: f.label });
      break;
    case "time":
      Object.assign(schema, { type: "string", title: f.label, pattern: TIME_PATTERN });
      break;
    case "select":
    case "radio":
      Object.assign(schema, { type: "string", title: f.label, enum: opts });
      if (f.type === "radio") ui["ui:widget"] = "radio";
      break;
    case "checkboxes":
      Object.assign(schema, { type: "array", title: f.label, items: { type: "string", enum: opts }, uniqueItems: true });
      ui["ui:widget"] = "checkboxes";
      break;
    default:
      return { schema: f.schema, ui: f.ui };
  }
  if (f.help) ui["ui:help"] = f.help;
  return { schema, ui: Object.keys(ui).length ? ui : undefined };
}

function setOrDrop(target: Json, key: string, value: unknown) {
  if (value === undefined || value === "") delete target[key];
  else target[key] = value;
}

/** A field's schema and uiSchema: the loaded ones with only the changed attributes rewritten. */
export function fieldToSchema(f: BuilderField): { schema: Json; ui?: Json } {
  const loaded = f.isNew ? null : readField(f.key, f.schema, f.ui, f.required);
  if (!loaded || (loaded.type !== f.type && f.type !== "advanced")) return freshField(f);

  const schema: Json = { ...f.schema };
  const ui: Json | undefined = f.ui ? { ...f.ui } : undefined;
  let uiOut = ui;

  if (f.label !== loaded.label) schema.title = f.label;
  if (f.help !== loaded.help) {
    if (f.helpIn === "schema") setOrDrop(schema, "description", f.help);
    else {
      uiOut = uiOut ?? {};
      setOrDrop(uiOut, "ui:help", f.help);
    }
  }
  if (f.type === "advanced") return { schema, ui: uiOut };

  if (f.options.join("\n") !== loaded.options.join("\n")) {
    const opts = f.options.map((o) => o.trim()).filter(Boolean);
    if (f.type === "checkboxes") schema.items = { ...(schema.items as Json), enum: opts };
    else schema.enum = opts;
  }
  if (f.maxLength !== loaded.maxLength) setOrDrop(schema, "maxLength", f.maxLength);
  if (f.minimum !== loaded.minimum) setOrDrop(schema, "minimum", f.minimum);
  if (f.maximum !== loaded.maximum) setOrDrop(schema, "maximum", f.maximum);
  return { schema, ui: uiOut };
}

/**
 * Where a field added in the editor goes: next to the question it was inserted beside, in that
 * question's section. `placed` maps the keys already positioned to their list and index; new keys
 * are slotted in against the editor's order, so several added in a row keep their order too.
 */
function insertNew(
  fieldKeys: string[],
  lists: string[][],
  placed: Map<string, { list: number; index: number }>,
  fallback: number
) {
  for (let i = 0; i < fieldKeys.length; i++) {
    const key = fieldKeys[i];
    if (placed.has(key)) continue;
    const before = fieldKeys.slice(0, i).reverse().find((k) => placed.has(k));
    const after = fieldKeys.slice(i + 1).find((k) => placed.has(k));
    const anchor = before ? placed.get(before)! : after ? placed.get(after)! : { list: fallback, index: 0 };
    const at = before ? anchor.index + 1 : anchor.index;
    lists[anchor.list].splice(at, 0, key);
    for (const [k, pos] of placed) if (pos.list === anchor.list && pos.index >= at) pos.index++;
    placed.set(key, { list: anchor.list, index: at });
  }
}

/**
 * ui:order with the editor's order written into the slots that top-level fields held. Entries
 * that are not top-level fields, such as fields added by a conditional branch, keep their places,
 * and a new field is written in beside the question it was added next to.
 */
function reorder(original: string[], fieldKeys: string[], loadedKeys: Set<string>): string[] {
  const kept = fieldKeys.filter((k) => loadedKeys.has(k) && original.includes(k));
  let next = 0;
  const out: string[] = [];
  const placed = new Map<string, { list: number; index: number }>();
  for (const k of original) {
    if (!loadedKeys.has(k)) out.push(k);
    else if (next < kept.length) {
      placed.set(kept[next], { list: 0, index: out.length });
      out.push(kept[next++]);
    }
  }
  const star = out.indexOf("*");
  insertNew(fieldKeys, [out], placed, 0);
  if (star !== -1 && out.indexOf("*") !== star) {
    // Keep the wildcard where it was: everything the editor placed goes before it.
    const wild = out.splice(out.indexOf("*"), 1);
    out.splice(star, 0, ...wild);
  }
  return out;
}

/** A section of a form, rendered as a numbered card (uiSchema "ui:groups"). */
export interface FormSection {
  title: string;
  description?: string;
  fields?: string[];
}

/**
 * Sections with the editor's order written into the slots top-level fields held, the same way as
 * ui:order. Moving a field past the first or last field of its section moves it into the next
 * section, and a field added between two questions joins the section they are in.
 */
function regroup(groups: FormSection[], fieldKeys: string[], loadedKeys: Set<string>): FormSection[] {
  const flat = groups.flatMap((g) => g.fields ?? []);
  const kept = fieldKeys.filter((k) => loadedKeys.has(k) && flat.includes(k));
  const lists: string[][] = groups.map(() => []);
  const placed = new Map<string, { list: number; index: number }>();
  let next = 0;

  groups.forEach((g, gi) => {
    for (const key of g.fields ?? []) {
      if (!loadedKeys.has(key)) {
        lists[gi].push(key);
      } else if (next < kept.length) {
        placed.set(kept[next], { list: gi, index: lists[gi].length });
        lists[gi].push(kept[next++]);
      }
    }
  });

  const last = groups.reduce((acc, g, gi) => (g.fields ? gi : acc), -1);
  if (last === -1) {
    const extra = fieldKeys.filter((k) => !placed.has(k));
    return extra.length ? [...groups, { title: "Additional questions", fields: extra }] : groups;
  }
  insertNew(fieldKeys, lists, placed, last);
  return groups.map((g, gi) => (g.fields ? { ...g, fields: lists[gi] } : g));
}

/** Write the editor's fields back into a form, starting from the form as it was loaded. */
export function fieldsToForm(base: Pick<FormDef, "schema" | "uiSchema">, meta: FormMeta, fields: BuilderField[]): FormDef {
  const loadedProps = (base.schema.properties ?? {}) as Json;
  const loadedKeys = new Set(Object.keys(loadedProps));
  const fieldKeys = fields.map((f) => f.key);
  const groups = base.uiSchema["ui:groups"] as FormSection[] | undefined;
  const hasOrder = Array.isArray(base.uiSchema["ui:order"]) || Array.isArray(groups);

  const uiSchema: Json = { ...base.uiSchema };
  for (const key of loadedKeys) if (!fieldKeys.includes(key)) delete uiSchema[key];

  const built = new Map(fields.map((f) => [f.key, fieldToSchema(f)]));
  // With ui:order present, display order lives there, so properties keep their loaded order.
  const propOrder = hasOrder
    ? [...Object.keys(loadedProps).filter((k) => built.has(k)), ...fieldKeys.filter((k) => !loadedKeys.has(k))]
    : fieldKeys;
  const properties: Json = {};
  for (const key of propOrder) {
    const { schema, ui } = built.get(key)!;
    properties[key] = schema;
    if (ui !== undefined) uiSchema[key] = ui;
    else delete uiSchema[key];
  }
  if (Array.isArray(base.uiSchema["ui:order"])) uiSchema["ui:order"] = reorder(base.uiSchema["ui:order"] as string[], fieldKeys, loadedKeys);
  if (Array.isArray(groups)) uiSchema["ui:groups"] = regroup(groups, fieldKeys, loadedKeys);

  const loadedRequired = (base.schema.required as string[] | undefined) ?? [];
  const want = new Set(fields.filter((f) => f.required).map((f) => f.key));
  const required = [
    ...loadedRequired.filter((k) => want.has(k) || (!loadedKeys.has(k) && !built.has(k))),
    ...fields.filter((f) => f.required && !loadedRequired.includes(f.key)).map((f) => f.key)
  ];

  const schema: Json = { ...base.schema, properties };
  if (required.length || "required" in base.schema) schema.required = required;
  return { meta, schema, uiSchema };
}

/* ---------------- New forms and fields ---------------- */

export function emptyForm(): FormDef {
  return {
    meta: {
      formId: "",
      code: "",
      title: "",
      summary: "",
      supportsConfidential: false,
      attachmentsRequired: false,
      departments: [],
      status: "active"
    },
    schema: { type: "object", required: [], properties: {} },
    uiSchema: {}
  };
}

/** "Bird strike report" to "bird-strike-report". */
export function slugify(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);
}

/** "Date of strike" to "dateOfStrike", unique among the keys given. */
export function fieldKeyFrom(label: string, taken: Iterable<string>): string {
  const words = label.normalize("NFKD").replace(/[^A-Za-z0-9 ]+/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 6);
  let key = words.map((w, i) => (i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join("") || "field";
  if (!/^[A-Za-z]/.test(key)) key = `field${key}`;
  const used = new Set(taken);
  let candidate = key;
  for (let n = 2; used.has(candidate); n++) candidate = `${key}${n}`;
  return candidate;
}

export function newField(type: FieldType, label: string, taken: Iterable<string>, options: string[] = []): BuilderField {
  return {
    key: fieldKeyFrom(label, taken),
    label,
    type,
    required: false,
    help: "",
    helpIn: "ui",
    options: isChoice(type) ? (options.length ? options : ["Option 1", "Option 2"]) : [],
    schema: {},
    isNew: true
  };
}

export function confidentialField(): BuilderField {
  return {
    ...newField("radio", "Submit this report confidentially", [], ["No", "Yes"]),
    key: CONFIDENTIAL_KEY,
    help: "Your name, staff number, email and department are withheld from everyone who handles this report."
  };
}

/* ---------------- Validation ---------------- */

export interface FormContext {
  /** Every other form, to keep codes and IDs unique. */
  others: FormMeta[];
  departments: string[];
  groups: string[];
  isNew: boolean;
}

/** Everything wrong with a form, in the order an editor would fix it. Empty means it can be saved. */
export function validateForm(def: FormDef, ctx: FormContext): string[] {
  const errors: string[] = [];
  const m = def.meta;
  const title = m.title?.trim() ?? "";
  const code = m.code?.trim() ?? "";

  if (!title) errors.push("Give the form a title.");
  else if (title.length > 120) errors.push("Keep the title under 120 characters.");
  if (!code) errors.push("Give the form a code, such as WLD-002.");
  else if (!/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/.test(code)) errors.push("Codes use letters, numbers and hyphens, up to 20 characters.");
  else if (ctx.others.some((o) => o.code.toLowerCase() === code.toLowerCase())) errors.push(`Code ${code} is already used by another form.`);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(m.formId ?? "")) errors.push("The form ID can only use lower-case letters, numbers and hyphens.");
  else if (ctx.isNew && ctx.others.some((o) => o.formId === m.formId)) errors.push(`A form with the ID ${m.formId} already exists.`);
  if ((m.summary ?? "").length > 200) errors.push("Keep the summary under 200 characters.");

  const depts = m.departments ?? [];
  if ((m.status ?? "active") === "active" && depts.length === 0) errors.push("Choose at least one department, or All staff, so someone can see the form.");
  const unknown = depts.filter((d) => d !== "*" && !ctx.departments.includes(d));
  if (unknown.length) errors.push(`Unknown department: ${unknown.join(", ")}.`);
  if (!m.gatekeeperGroup || !ctx.groups.includes(m.gatekeeperGroup)) errors.push("Choose the gatekeeper group this form routes to.");

  const fields = formToFields(def);
  if (fields.length === 0) errors.push("Add at least one field.");
  const seen = new Set<string>();
  for (const f of fields) {
    const name = f.label || f.key;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(f.key)) errors.push(`"${name}" has an invalid key. Keys start with a letter and use letters and numbers only.`);
    if (seen.has(f.key)) errors.push(`Two fields share the key ${f.key}.`);
    seen.add(f.key);
    if (!f.label.trim()) errors.push(`The field ${f.key} needs a label.`);
    if (isChoice(f.type)) {
      const opts = f.options.map((o) => o.trim());
      if (opts.filter(Boolean).length === 0) errors.push(`"${name}" needs at least one option.`);
      if (new Set(opts).size !== opts.length) errors.push(`"${name}" lists the same option twice.`);
    }
    if (f.maxLength !== undefined && (!Number.isInteger(f.maxLength) || f.maxLength < 1 || f.maxLength > 10000)) {
      errors.push(`"${name}": the character limit must be a whole number from 1 to 10,000.`);
    }
    if (f.minimum !== undefined && f.maximum !== undefined && f.minimum > f.maximum) errors.push(`"${name}": the minimum is above the maximum.`);
  }

  if (m.supportsConfidential) {
    const c = fields.find((f) => f.key === CONFIDENTIAL_KEY);
    if (!c || !c.options.includes("Yes")) {
      errors.push(`Forms that can be filed confidentially need a "${CONFIDENTIAL_KEY}" field with a Yes option.`);
    }
  }
  return errors;
}

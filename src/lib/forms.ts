import fs from "fs";
import path from "path";
import personaMap from "@config/persona-form-map.json";
import routing from "@config/gatekeeper-groups.json";
import masters from "@config/masters.json";
import { readConfig, updateConfig } from "@/lib/store";
import type { FormDef } from "@/lib/types";

export type { FormDef };

/**
 * The form registry. The files in config/forms are the shipped forms; anything saved from the
 * form editor (Administration → Forms) is stored in the datastore and wins over the file with the
 * same ID. Visibility and routing live on each form's meta, filled in from the persona map and
 * gatekeeper routing for shipped forms that have never been edited.
 */

const dir = path.join(process.cwd(), "config", "forms");
let shipped: FormDef[] | null = null;

function normalise(def: FormDef): FormDef {
  const id = def.meta.formId;
  return {
    ...def,
    meta: {
      ...def.meta,
      departments: def.meta.departments ?? (personaMap.map as Record<string, string[]>)[id] ?? [],
      gatekeeperGroup: def.meta.gatekeeperGroup ?? (routing.routing as Record<string, string>)[id] ?? "safety-flight-ops",
      status: def.meta.status ?? "active",
      version: def.meta.version ?? 1
    }
  };
}

function shippedForms(): FormDef[] {
  if (!shipped) {
    shipped = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => normalise(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as FormDef));
  }
  return shipped;
}

async function savedForms(): Promise<Record<string, FormDef>> {
  return (await readConfig<Record<string, FormDef>>("forms")) ?? {};
}

/** Every form, active and retired, with saved versions overlaid on the shipped files. */
export async function listAllForms(): Promise<FormDef[]> {
  const byId = new Map(shippedForms().map((f) => [f.meta.formId, f]));
  for (const def of Object.values(await savedForms())) byId.set(def.meta.formId, normalise(def));
  return [...byId.values()].sort((a, b) => a.meta.title.localeCompare(b.meta.title));
}

/** Forms reporters can file. */
export async function listForms(): Promise<FormDef[]> {
  return (await listAllForms()).filter((f) => f.meta.status !== "retired");
}

export async function getForm(formId: string, opts: { includeRetired?: boolean } = {}): Promise<FormDef | null> {
  const def = (await listAllForms()).find((f) => f.meta.formId === formId) ?? null;
  if (def && def.meta.status === "retired" && !opts.includeRetired) return null;
  return def;
}

/** BRD: a form not mapped to the user's department is neither shown nor reachable by URL. */
export function isVisibleTo(def: FormDef, department: string): boolean {
  const depts = def.meta.departments ?? [];
  return def.meta.status !== "retired" && (depts.includes("*") || depts.includes(department));
}

export async function formsForDepartment(department: string): Promise<FormDef[]> {
  return (await listForms()).filter((f) => isVisibleTo(f, department));
}

export async function gatekeeperGroupFor(def: FormDef): Promise<string> {
  // Try to get from form-gatekeeper mappings first
  try {
    const { readJson } = await import("./store/driver");
    interface FormGatekeeperMapping {
      formId: string;
      gatekeeperGroup: string;
    }
    const mappings = await readJson<FormGatekeeperMapping[]>("form-gatekeeper-mappings").catch(() => []) as FormGatekeeperMapping[];
    const mapping = mappings.find(m => m.formId === def.meta.formId);
    if (mapping) {
      return mapping.gatekeeperGroup;
    }
  } catch (error) {
    console.log("Could not load form-gatekeeper mappings, using default");
  }

  // Fallback to form meta or default
  return def.meta.gatekeeperGroup ?? "safety-gatekeepers";
}

/** Save a form from the editor. The caller has validated it; this stamps the version. */
export async function saveForm(def: FormDef, actor: { name: string; email: string }, isNew: boolean): Promise<FormDef> {
  const current = isNew ? null : await getForm(def.meta.formId, { includeRetired: true });
  const saved: FormDef = {
    ...def,
    meta: {
      ...def.meta,
      version: (current?.meta.version ?? 0) + 1,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.name
    }
  };
  await updateConfig<Record<string, FormDef>>(
    "forms",
    {},
    (all) => ({ ...all, [saved.meta.formId]: saved }),
    `feat(forms): ${isNew ? "create" : "update"} ${saved.meta.formId} v${saved.meta.version}`,
    actor
  );
  return saved;
}

export const DEPARTMENTS: string[] = masters.departments;

export function gatekeeperGroups(): { key: string; name: string }[] {
  return Object.entries(routing.groups).map(([key, g]) => ({ key, name: g.name }));
}

/**
 * Rules that JSON Schema cannot express on its own. BRD common validation: occurrence dates are
 * past dates only; target and completion dates may be in the future.
 */
export function extraValidation(def: FormDef, data: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const titles = (def.schema.properties ?? {}) as Record<string, { title?: string }>;
  for (const [key, value] of Object.entries(data)) {
    const isOccurrence = /^(dateOf|dateTimeOf)|^flightDate$/.test(key);
    if (isOccurrence && typeof value === "string" && value.slice(0, 10) > today) {
      errors.push(`${titles[key]?.title ?? key}: occurrence dates cannot be in the future.`);
    }
  }
  return errors;
}


import validator from "@rjsf/validator-ajv8";
import { listAllForms, saveForm, DEPARTMENTS, gatekeeperGroups } from "@/lib/forms";
import { validateForm } from "@/lib/form-builder";
import type { FormDef, FormMeta } from "@/lib/types";

type Result = { ok: true; form: FormDef } | { ok: false; status: number; errors: string[] };

const MAX_SCHEMA_BYTES = 200_000;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Only the meta an editor may set. Version and audit stamps are the server's. */
function cleanMeta(raw: Record<string, unknown>): FormMeta {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  return {
    formId: str(raw.formId),
    code: str(raw.code),
    title: str(raw.title),
    summary: str(raw.summary),
    supportsConfidential: raw.supportsConfidential === true,
    attachmentsRequired: raw.attachmentsRequired === true,
    departments: Array.isArray(raw.departments) ? raw.departments.filter((d): d is string => typeof d === "string") : [],
    gatekeeperGroup: str(raw.gatekeeperGroup),
    status: raw.status === "retired" ? "retired" : "active"
  };
}

/** Validate a form sent by the editor and save it as the next version (US-16, US-17). */
export async function checkAndSaveForm(
  input: unknown,
  actor: { name: string; email: string },
  opts: { isNew: boolean; formId?: string }
): Promise<Result> {
  if (!isObject(input) || !isObject(input.meta) || !isObject(input.schema) || !isObject(input.uiSchema)) {
    return { ok: false, status: 400, errors: ["Send a form with meta, schema and uiSchema."] };
  }
  if (JSON.stringify(input).length > MAX_SCHEMA_BYTES) {
    return { ok: false, status: 413, errors: ["This form is too large to save."] };
  }

  const meta = cleanMeta(input.meta);
  if (opts.formId) meta.formId = opts.formId;
  const def: FormDef = { meta, schema: input.schema, uiSchema: input.uiSchema };

  const all = await listAllForms();
  const existing = all.find((f) => f.meta.formId === meta.formId);
  if (!opts.isNew && !existing) return { ok: false, status: 404, errors: ["Form not found."] };

  const errors = validateForm(def, {
    others: all.filter((f) => f.meta.formId !== meta.formId || opts.isNew).map((f) => f.meta),
    departments: DEPARTMENTS,
    groups: gatekeeperGroups().map((g) => g.key),
    isNew: opts.isNew
  });
  if (def.schema.type !== "object" || !isObject(def.schema.properties)) errors.push("The schema must be an object with properties.");
  if (!errors.length) {
    const compiled = validator.rawValidation(def.schema as never, {});
    if (compiled.validationError) errors.push(`The schema does not compile: ${compiled.validationError.message}`);
  }
  if (errors.length) return { ok: false, status: 422, errors };

  return { ok: true, form: await saveForm(def, actor, opts.isNew) };
}

"use client";
import type { ReactNode } from "react";
import Form from "@rjsf/core";
import validator from "@rjsf/validator-ajv8";
import { AirproxDiagramField } from "@/components/airprox-diagram";
import type {
  ArrayFieldTemplateProps,
  FieldTemplateProps,
  ObjectFieldTemplateProps,
  RJSFValidationError,
  UiSchema
} from "@rjsf/utils";

type Json = Record<string, unknown>;

interface Group {
  title: string;
  description?: string;
  fields?: string[];
}

/* A field spans both columns when it holds a long answer or a list of choices. */
function isWide(schema: Json | undefined, ui: Json | undefined): boolean {
  const options = (ui?.["ui:options"] ?? {}) as Json;
  if (options.fullWidth) return true;
  const widget = ui?.["ui:widget"];
  if (widget === "textarea" || widget === "checkboxes") return true;
  if (schema?.type === "array" || schema?.type === "object") return true;
  return widget === "radio" && Array.isArray(schema?.enum) && (schema!.enum as unknown[]).length > 4;
}

/* ---------------- The common fields, filled in from the account (BRD 6) ---------------- */

export interface Identity {
  name: string;
  email: string;
  staffNo: string;
  department: string;
}

interface FormContext {
  identity?: Identity | null;
  /** Set when the report is already known to be confidential, such as when it is being corrected. */
  identityWithheld?: boolean;
}

function IdentitySection({ identity, withheld, index }: { identity: Identity; withheld: boolean; index: number }) {
  const rows: [string, string][] = [
    ["Name", identity.name],
    ["Email ID", identity.email],
    ["Staff number", identity.staffNo],
    ["Department", identity.department]
  ];
  return (
    <section className="form-section">
      <header className="flex items-start gap-3">
        <span className="form-section-index" aria-hidden="true">{index}</span>
        <div className="min-w-0">
          <h3 className="text-[0.9375rem] font-semibold text-ink">Your details</h3>
          <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate1">
            {withheld
              ? "Withheld. You chose to file this report confidentially, so your name, email, staff number and department are not part of it."
              : "Filled in from your account. These cannot be edited."}
          </p>
        </div>
      </header>
      {!withheld && (
        <div className="mt-5 grid gap-x-5 gap-y-4 md:grid-cols-2">
          {rows.map(([label, value]) => (
            <div className="field" key={label}>
              <span className="field-label">{label}</span>
              <p className="form-control bg-surface text-slate1">{value || "Not set"}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/* ---------------- Sections (uiSchema "ui:groups") ---------------- */

function ObjectFieldTemplate(props: ObjectFieldTemplateProps) {
  const { properties, uiSchema, schema, idSchema, formData, registry } = props;
  const context = (registry?.formContext ?? {}) as FormContext;
  const identity = idSchema.$id === "root" ? context.identity : null;
  // BRD 6: the common fields are not shown at all once the reporter chooses confidentiality.
  const withheld = Boolean(context.identityWithheld) || (formData as Json | undefined)?.confidential === "Yes";
  const groups = (uiSchema?.["ui:groups"] as Group[] | undefined) ?? null;
  const byName = new Map(properties.map((p) => [p.name, p]));
  const fieldSchema = (name: string) => ((schema.properties ?? {}) as Record<string, Json>)[name];

  const cell = (name: string) => {
    const p = byName.get(name);
    if (!p || p.hidden) return null;
    const wide = isWide(fieldSchema(name), (uiSchema?.[name] ?? {}) as Json);
    return (
      <div key={name} className={wide ? "md:col-span-2" : undefined}>
        {p.content}
      </div>
    );
  };

  // Nested objects (a passenger in a repeating section) are a plain grid.
  if (!groups || idSchema.$id !== "root") {
    const grid = <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">{properties.map((p) => cell(p.name))}</div>;
    if (!identity) return grid;
    return (
      <div className="space-y-5">
        <IdentitySection identity={identity} withheld={withheld} index={1} />
        {grid}
      </div>
    );
  }

  const placed = new Set(groups.flatMap((g) => g.fields ?? []));
  const leftovers = properties.map((p) => p.name).filter((n) => !placed.has(n));
  const all: Group[] = leftovers.length ? [...groups, { title: "Additional questions", fields: leftovers }] : groups;
  const offset = identity ? 2 : 1;

  return (
    <div className="space-y-5">
      {identity && <IdentitySection identity={identity} withheld={withheld} index={1} />}
      {all.map((g, i) => {
        const cells = (g.fields ?? []).map(cell).filter(Boolean);
        return (
          <section key={g.title} className="form-section">
            <header className="flex items-start gap-3">
              <span className="form-section-index" aria-hidden="true">{i + offset}</span>
              <div className="min-w-0">
                <h3 className="text-[0.9375rem] font-semibold text-ink">{g.title}</h3>
                {g.description && <p className="mt-1 text-[0.8125rem] leading-relaxed text-slate1">{g.description}</p>}
              </div>
            </header>
            {cells.length > 0 && <div className="mt-5 grid gap-x-5 gap-y-5 md:grid-cols-2">{cells}</div>}
          </section>
        );
      })}
    </div>
  );
}

/* ---------------- One question ---------------- */

function FieldTemplate(props: FieldTemplateProps) {
  const { id, label, children, rawErrors, rawHelp, rawDescription, hidden, required, displayLabel, schema } = props;
  if (hidden) return <div className="hidden">{children}</div>;
  // Objects and arrays render their own chrome.
  if (schema.type === "object" || (schema.type === "array" && !(schema.items as Json | undefined)?.enum)) return <>{children}</>;
  const errors = (rawErrors ?? []).filter(Boolean);
  const isChoiceGroup = schema.type === "array" || (Array.isArray(schema.enum) && props.uiSchema?.["ui:widget"] === "radio");
  return (
    <div className={`field ${errors.length ? "field-invalid" : ""}`}>
      {displayLabel && label && (
        isChoiceGroup ? (
          <p className="field-label" id={`${id}__label`}>
            {label}
            {required && <span className="text-risk-red" aria-hidden="true"> *</span>}
          </p>
        ) : (
          <label htmlFor={id} className="field-label">
            {label}
            {required && <span className="text-risk-red" aria-hidden="true"> *</span>}
          </label>
        )
      )}
      {rawDescription && <p className="field-hint -mt-0.5 mb-2">{rawDescription}</p>}
      {children}
      {errors.length > 0 ? (
        <p className="field-error" role="alert">{errors[0]}</p>
      ) : (
        rawHelp && <p className="field-hint mt-1.5">{rawHelp}</p>
      )}
    </div>
  );
}

/* ---------------- Repeating sections ---------------- */

function ArrayFieldTemplate(props: ArrayFieldTemplateProps) {
  const { items, canAdd, onAddClick, title, schema, uiSchema, required } = props;
  const noun = (title ?? "Item").replace(/s$/, "");
  const addLabel = ((uiSchema?.["ui:options"] ?? {}) as Json).addButtonLabel as string | undefined;
  return (
    <div>
      <p className="field-label">
        {title}
        {required && <span className="text-risk-red" aria-hidden="true"> *</span>}
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.key} className="rounded-xl border border-line bg-surface/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{noun} {item.index + 1}</p>
              {item.hasRemove && items.length > ((schema.minItems as number | undefined) ?? 0) && (
                <button type="button" className="text-[0.8125rem] font-medium text-risk-red hover:underline" onClick={item.onDropIndexClick(item.index)}>
                  Remove
                </button>
              )}
            </div>
            {item.children}
          </div>
        ))}
      </div>
      {canAdd && (
        <button type="button" className="btn-ghost mt-3" onClick={onAddClick}>
          + {addLabel ?? `Add ${noun.toLowerCase()}`}
        </button>
      )}
      {typeof schema.maxItems === "number" && <p className="field-hint mt-1.5">Up to {schema.maxItems}.</p>}
    </div>
  );
}

/* ---------------- Plain-language errors ---------------- */

const PATTERN_MESSAGES: [string, string][] = [
  ["[0-9]{10}", "Enter a 10-digit number."],
  ["[01][0-9]|2[0-3]", "Use the 24-hour format HH:MM, for example 07:45."],
  ["[A-Za-z0-9]{2,3}", "Enter a flight number, for example ZZ 101."],
  ["^[A-Za-z]{4}$", "Use the 4-letter ICAO code, for example VIDP."]
];

export function transformErrors(errors: RJSFValidationError[]): RJSFValidationError[] {
  return errors
    .filter((e) => !["oneOf", "const", "anyOf", "if"].includes(e.name ?? ""))
    .map((e) => {
      const p = (e.params ?? {}) as Json;
      let message = e.message ?? "Check this answer.";
      switch (e.name) {
        case "required":
          message = "This question is required.";
          break;
        case "minLength":
          message = `Write at least ${p.limit} characters.`;
          break;
        case "maxLength":
          message = `Keep this under ${p.limit} characters.`;
          break;
        case "minItems":
          message = "Choose at least one.";
          break;
        case "maxItems":
          message = `No more than ${p.limit}.`;
          break;
        case "minimum":
          message = `Must be ${p.limit} or more.`;
          break;
        case "maximum":
          message = `Must be ${p.limit} or less.`;
          break;
        case "type":
          message = p.type === "number" || p.type === "integer" ? "Enter a number." : "Check this answer.";
          break;
        case "format":
          message = p.format === "email" ? "Enter a valid email address." : "Check the date or time.";
          break;
        case "pattern":
          message = PATTERN_MESSAGES.find(([needle]) => String(p.pattern).includes(needle))?.[1] ?? "Check the format of this answer.";
          break;
      }
      return { ...e, message, stack: message };
    });
}

/* ---------------- The form ---------------- */

interface Props {
  schema: Json;
  uiSchema?: Json;
  formData: Json;
  onChange?: (data: Json) => void;
  onSubmit?: (data: Json) => void;
  disabled?: boolean;
  id?: string;
  /** The common fields, shown read-only at the top of the form (BRD 6). Omit to leave them out. */
  identity?: Identity | null;
  /** The report is already confidential, so the common fields stay hidden whatever the form says. */
  identityWithheld?: boolean;
  children?: ReactNode;
}

/** Fields a form can ask for that are more than a question: see config/forms/README.md. */
const fields = { airproxDiagram: AirproxDiagramField };

/** Every report form in the app: sections, two-column layout and plain-language errors. */
export default function SmsForm({
  schema, uiSchema, formData, onChange, onSubmit, disabled, id, identity, identityWithheld, children
}: Props) {
  return (
    <Form
      id={id}
      className="rjsf"
      schema={schema as never}
      uiSchema={(uiSchema ?? {}) as UiSchema}
      formData={formData}
      validator={validator}
      templates={{ ObjectFieldTemplate, FieldTemplate, ArrayFieldTemplate }}
      fields={fields}
      formContext={{ identity, identityWithheld } satisfies FormContext}
      transformErrors={transformErrors}
      showErrorList={false}
      noHtml5Validate
      focusOnFirstError
      disabled={disabled}
      onChange={(e) => onChange?.(e.formData)}
      onSubmit={(e) => onSubmit?.(e.formData)}
    >
      {children ?? <></>}
    </Form>
  );
}

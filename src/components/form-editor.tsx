"use client";
import { Component, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormDef, FormMeta } from "@/lib/types";
import SmsForm from "@/components/sms-form";
import {
  CONFIDENTIAL_KEY,
  FIELD_TYPES,
  confidentialField,
  emptyForm,
  fieldKeyFrom,
  fieldsToForm,
  formToFields,
  isChoice,
  newField,
  slugify,
  typeLabel,
  validateForm,
  type BuilderField,
  type FieldType
} from "@/lib/form-builder";

interface Props {
  /** Null for a new form. */
  initial: FormDef | null;
  /** Every other form, for unique codes and IDs. */
  others: FormMeta[];
  departments: string[];
  groups: { key: string; name: string }[];
}

type Row = BuilderField & { uid: string; keyTouched?: boolean };

let uidCounter = 0;
const nextUid = () => `f${++uidCounter}`;
const toRows = (def: Pick<FormDef, "schema" | "uiSchema">): Row[] => formToFields(def).map((f) => ({ ...f, uid: nextUid() }));
const strip = (rows: Row[]): BuilderField[] => rows.map(({ uid: _u, keyTouched: _k, ...f }) => f);

class PreviewBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error) return <p className="text-sm text-risk-red">The preview cannot show this form yet: {this.state.error}</p>;
    return this.props.children;
  }
}

/** Administration → Forms → new or edit (US-16, US-17). */
export default function FormEditor({ initial, others, departments, groups }: Props) {
  const router = useRouter();
  const isNew = !initial;
  const start = useMemo(() => {
    const def = initial ?? emptyForm();
    return { ...def, meta: { ...def.meta, gatekeeperGroup: def.meta.gatekeeperGroup || groups[0]?.key } };
  }, [initial, groups]);

  const [base, setBase] = useState({ schema: start.schema, uiSchema: start.uiSchema });
  const [meta, setMeta] = useState<FormMeta>(start.meta);
  const [rows, setRows] = useState<Row[]>(() => toRows(start));
  const [open, setOpen] = useState<string | null>(null);
  const [insertAt, setInsertAt] = useState<number | null>(null);
  const [idTouched, setIdTouched] = useState(!isNew);
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(start));
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<Record<string, unknown>>({});

  const built = useMemo(() => fieldsToForm(base, meta, strip(rows)), [base, meta, rows]);
  // Which section each field will sit in once saved, so inserting at a position is predictable.
  const sectionOf = useMemo(() => {
    const groups = (built.uiSchema["ui:groups"] as { title: string; fields?: string[] }[] | undefined) ?? [];
    const map = new Map<string, string>();
    for (const g of groups) for (const key of g.fields ?? []) map.set(key, g.title);
    return map;
  }, [built]);
  const dirty = JSON.stringify(built) !== snapshot;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  /* ---------- Details ---------- */

  function setTitle(title: string) {
    setMeta((m) => ({ ...m, title, formId: isNew && !idTouched ? slugify(title) : m.formId }));
  }

  function setConfidential(on: boolean) {
    setMeta((m) => ({ ...m, supportsConfidential: on }));
    if (on && !rows.some((r) => r.key === CONFIDENTIAL_KEY)) {
      setRows((rs) => [{ ...confidentialField(), uid: nextUid() }, ...rs]);
    }
  }

  const allStaff = (meta.departments ?? []).includes("*");
  function toggleDepartment(d: string, on: boolean) {
    setMeta((m) => {
      const current = (m.departments ?? []).filter((x) => x !== "*");
      return { ...m, departments: on ? [...current, d] : current.filter((x) => x !== d) };
    });
  }

  /* ---------- Fields ---------- */

  const takenKeys = (except?: string) => [
    ...rows.filter((r) => r.uid !== except).map((r) => r.key),
    ...Object.keys(base.uiSchema),
    ...((base.uiSchema["ui:order"] as string[] | undefined) ?? [])
  ];

  /** Add a field at a position: `at` is the gap it goes into, and the end when left out. */
  function addField(kind: string, at?: number) {
    if (!kind) return;
    // Starts blank so the admin types the question straight away; the key follows as they type.
    const field = kind === "yesno" ? newField("radio", "", takenKeys(), ["Yes", "No"]) : newField(kind as FieldType, "", takenKeys());
    const row = { ...field, uid: nextUid() };
    setRows((rs) => {
      const i = at ?? rs.length;
      return [...rs.slice(0, i), row, ...rs.slice(i)];
    });
    setInsertAt(null);
    setOpen(row.uid);
  }

  function update(uid: string, patch: Partial<Row>) {
    setRows((rs) =>
      rs.map((r) => {
        if (r.uid !== uid) return r;
        const next = { ...r, ...patch };
        if (patch.label !== undefined && keyEditable(r) && !r.keyTouched) next.key = fieldKeyFrom(patch.label, takenKeys(uid));
        return next;
      })
    );
  }

  function move(uid: string, dir: -1 | 1) {
    setRows((rs) => {
      const i = rs.findIndex((r) => r.uid === uid);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= rs.length) return rs;
      const next = rs.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function remove(row: Row) {
    const saved = !row.isNew && !isNew;
    if (saved && !window.confirm(`Remove "${row.label}"? Reports already filed keep their answers to it, but new reports will not ask it.`)) return;
    setRows((rs) => rs.filter((r) => r.uid !== row.uid));
  }

  /** Keys are fixed once a form is saved, so filed reports stay aligned with their questions. */
  const keyEditable = (r: Row) => isNew || Boolean(r.isNew);

  /**
   * A field goes in where you want it, rather than at the end to be walked up with the arrows. The
   * gap between two questions is also a gap between sections, so inserting here puts the new
   * question in the section shown above it.
   */
  function InsertHere({ at }: { at: number }) {
    if (insertAt === at) {
      return (
        <div className="my-2 flex items-center gap-2 rounded-xl border border-chart bg-chartsoft/50 p-2">
          <select
            className="input w-auto"
            defaultValue=""
            autoFocus
            aria-label={`Insert a field at position ${at + 1}`}
            onChange={(e) => addField(e.target.value, at)}
          >
            <option value="">Choose a type…</option>
            {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
            <option value="yesno">Yes / No</option>
          </select>
          <button type="button" className="btn-ghost px-2.5 py-1.5" onClick={() => setInsertAt(null)}>Cancel</button>
        </div>
      );
    }
    return (
      <div className="group relative flex h-6 items-center">
        <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-line" aria-hidden="true" />
        <button
          type="button"
          className="relative mx-auto rounded-full border border-line bg-white px-2.5 py-0.5 text-[0.75rem] font-medium text-slate1 transition hover:border-chart hover:text-chart"
          onClick={() => setInsertAt(at)}
        >
          + Insert here
        </button>
      </div>
    );
  }

  /* ---------- JSON view ---------- */

  function loadJson() {
    setJsonText(JSON.stringify({ schema: built.schema, uiSchema: built.uiSchema }, null, 2));
    setJsonError(null);
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText) as { schema?: unknown; uiSchema?: unknown };
      const ok = (v: unknown) => typeof v === "object" && v !== null && !Array.isArray(v);
      if (!ok(parsed.schema) || !ok(parsed.uiSchema)) throw new Error("Expected an object with schema and uiSchema.");
      const next = { schema: parsed.schema as Record<string, unknown>, uiSchema: parsed.uiSchema as Record<string, unknown> };
      setBase(next);
      setRows(toRows(next));
      setOpen(null);
      setJsonError(null);
      setNotice("JSON applied. Save to keep it.");
    } catch (e) {
      setJsonError(e instanceof Error ? e.message : "That is not valid JSON.");
    }
  }

  /* ---------- Save ---------- */

  async function save() {
    setNotice(null);
    const problems = validateForm(built, { others, departments, groups: groups.map((g) => g.key), isNew });
    if (problems.length) {
      setErrors(problems);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBusy(true);
    setErrors([]);
    const res = await fetch(isNew ? "/api/admin/forms" : `/api/admin/forms/${meta.formId}`, {
      method: isNew ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(built)
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErrors(body.errors ?? [body.error ?? "The form was not saved."]);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const saved = body as FormDef;
    setSnapshot(JSON.stringify(saved));
    if (isNew) {
      router.push(`/admin/forms/${saved.meta.formId}`);
      router.refresh();
      return;
    }
    setBase({ schema: saved.schema, uiSchema: saved.uiSchema });
    setMeta(saved.meta);
    setRows(toRows(saved));
    setNotice(`Saved as version ${saved.meta.version}.`);
    router.refresh();
  }

  const visibleTo = allStaff ? "all staff" : (meta.departments ?? []).join(", ") || "nobody yet";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/admin/forms" className="text-[0.8125rem] text-chart">← All forms</Link>
          <h1 className="text-2xl font-semibold mt-1">{isNew ? "New form" : meta.title || "Untitled form"}</h1>
          {!isNew && (
            <p className="text-[0.8125rem] text-slate1 mt-0.5">
              <span className="id">{meta.code}</span> · version {meta.version ?? 1}
              {meta.updatedBy && ` · last saved by ${meta.updatedBy}`}
              {meta.updatedAt && ` on ${new Date(meta.updatedAt).toLocaleString("en-IN")}`}
              {meta.status === "retired" && " · retired"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {dirty && <span className="text-[0.8125rem] text-slate1">Unsaved changes</span>}
          <button type="button" className="btn-primary" disabled={busy || (!dirty && !isNew)} onClick={save}>
            {busy ? "Saving" : isNew ? "Create form" : "Save new version"}
          </button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 rounded-xl border border-risk-red/30 bg-risk-red/5 p-4" role="alert">
          <p className="text-sm font-medium text-risk-red">Not saved. Fix these first:</p>
          <ul className="mt-2 space-y-1 text-sm text-risk-red list-disc pl-5">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {notice && <p className="mt-4 rounded-xl border border-risk-green/30 bg-risk-green/10 p-3 text-sm">{notice}</p>}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,30rem)]">
        <div className="space-y-5 min-w-0">
          {/* Details */}
          <section className="card p-5">
            <h2 className="font-semibold">Details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="label block mb-1.5">Title</span>
                <input className="input" value={meta.title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Wildlife (Bird Strike) Report" />
              </label>
              <label className="block">
                <span className="label block mb-1.5">Code</span>
                <input className="input id" value={meta.code} maxLength={20} onChange={(e) => setMeta({ ...meta, code: e.target.value.toUpperCase() })} placeholder="WLD-002" />
              </label>
              <label className="block">
                <span className="label block mb-1.5">Form ID</span>
                {isNew ? (
                  <input
                    className="input id"
                    value={meta.formId}
                    maxLength={60}
                    onChange={(e) => {
                      setIdTouched(true);
                      setMeta({ ...meta, formId: slugify(e.target.value) });
                    }}
                    placeholder="bird-strike-report"
                  />
                ) : (
                  <p className="input id bg-surface text-slate1">{meta.formId}</p>
                )}
                <span className="block text-[0.75rem] text-slate1 mt-1">Used in the form&apos;s address. Fixed after the first save.</span>
              </label>
              <label className="block sm:col-span-2">
                <span className="label block mb-1.5">One-line summary</span>
                <input className="input" value={meta.summary} maxLength={200} onChange={(e) => setMeta({ ...meta, summary: e.target.value })} placeholder="Shown on the form picker" />
              </label>
              <label className="block">
                <span className="label block mb-1.5">Routes to gatekeeper group</span>
                <select className="input" value={meta.gatekeeperGroup} onChange={(e) => setMeta({ ...meta, gatekeeperGroup: e.target.value })}>
                  {groups.map((g) => <option key={g.key} value={g.key}>{g.name}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="label block mb-1.5">Status</span>
                <select className="input" value={meta.status ?? "active"} onChange={(e) => setMeta({ ...meta, status: e.target.value as FormMeta["status"] })}>
                  <option value="active">Active: reporters can file it</option>
                  <option value="retired">Retired: hidden from reporters</option>
                </select>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-chart" checked={meta.supportsConfidential} onChange={(e) => setConfidential(e.target.checked)} />
                Can be filed confidentially
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-chart" checked={meta.attachmentsRequired} onChange={(e) => setMeta({ ...meta, attachmentsRequired: e.target.checked })} />
                At least one attachment required
              </label>
            </div>
            {meta.status === "retired" && (
              <p className="mt-3 text-[0.8125rem] text-slate1">
                Retired forms disappear from the picker and cannot be submitted. Reports already filed on this form are not affected.
              </p>
            )}
          </section>

          {/* Visibility */}
          <section className="card p-5">
            <h2 className="font-semibold">Who can see this form</h2>
            <p className="text-[0.8125rem] text-slate1 mt-0.5">Checked on the server: the picker, the form&apos;s address and submission all follow this.</p>
            <div className="mt-4 flex flex-wrap gap-5 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="visibility" className="accent-chart" checked={allStaff} onChange={() => setMeta({ ...meta, departments: ["*"] })} />
                All staff
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" name="visibility" className="accent-chart" checked={!allStaff} onChange={() => setMeta({ ...meta, departments: [] })} />
                Only these departments
              </label>
            </div>
            {!allStaff && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {departments.map((d) => (
                  <label key={d} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-chart" checked={(meta.departments ?? []).includes(d)} onChange={(e) => toggleDepartment(d, e.target.checked)} />
                    {d}
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Fields */}
          <section className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Fields</h2>
                <p className="text-[0.8125rem] text-slate1 mt-0.5">
                  {rows.length} field{rows.length === 1 ? "" : "s"}, in the order reporters answer them. Add one at the end from
                  the menu, or between two questions with Insert here. The reporter&apos;s name, email, staff number and
                  department are asked for by every form automatically.
                </p>
              </div>
              <select className="input w-auto" value="" onChange={(e) => addField(e.target.value)} aria-label="Add a field">
                <option value="">Add a field…</option>
                {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                <option value="yesno">Yes / No</option>
              </select>
            </div>

            <div className="mt-4" role="list">
              <InsertHere at={0} />
              {rows.map((r, i) => {
                const expanded = open === r.uid;
                const section = sectionOf.get(r.key);
                const newSection = section && section !== sectionOf.get(rows[i - 1]?.key ?? "");
                return (
                  <div key={r.uid} role="listitem">
                  {newSection && (
                    <p className="eyebrow mb-1.5 mt-3 first:mt-0">{section}</p>
                  )}
                  <div className={`rounded-xl border ${expanded ? "border-chart" : "border-line"}`}>
                    <div className="flex items-center gap-2 p-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-medium truncate ${r.label ? "" : "text-slate1"}`}>
                          {r.label || "Untitled question"}
                          {r.required && <span className="text-risk-red" aria-label="required"> *</span>}
                        </p>
                        <p className="text-[0.75rem] text-slate1 truncate">
                          {typeLabel(r.type)} · <span className="id">{r.key}</span>
                          {r.isNew && " · new"}
                        </p>
                      </div>
                      <button type="button" className="btn-ghost px-2 py-1.5" aria-label={`Move ${r.label} up`} disabled={i === 0} onClick={() => move(r.uid, -1)}>↑</button>
                      <button type="button" className="btn-ghost px-2 py-1.5" aria-label={`Move ${r.label} down`} disabled={i === rows.length - 1} onClick={() => move(r.uid, 1)}>↓</button>
                      <button type="button" className="btn-ghost px-2.5 py-1.5" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : r.uid)}>
                        {expanded ? "Done" : "Edit"}
                      </button>
                      <button type="button" className="btn-ghost px-2.5 py-1.5 text-risk-red" onClick={() => remove(r)}>Remove</button>
                    </div>

                    {expanded && (
                      <div className="border-t border-line p-4 grid gap-3 sm:grid-cols-2">
                        <label className="block sm:col-span-2">
                          <span className="label block mb-1.5">Question</span>
                          <input className="input" value={r.label} onChange={(e) => update(r.uid, { label: e.target.value })} placeholder="Type the question reporters will see" autoFocus />
                        </label>
                        <label className="block">
                          <span className="label block mb-1.5">Type</span>
                          {r.type === "advanced" ? (
                            <p className="input bg-surface text-slate1">Advanced: edit in the JSON view</p>
                          ) : (
                            <select
                              className="input"
                              value={r.type}
                              onChange={(e) => {
                                const type = e.target.value as FieldType;
                                update(r.uid, { type, options: isChoice(type) && r.options.length === 0 ? ["Option 1", "Option 2"] : r.options });
                              }}
                            >
                              {FIELD_TYPES.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
                            </select>
                          )}
                        </label>
                        <label className="block">
                          <span className="label block mb-1.5">Key</span>
                          {keyEditable(r) ? (
                            <input
                              className="input id"
                              value={r.key}
                              onChange={(e) => update(r.uid, { key: e.target.value.replace(/[^A-Za-z0-9]/g, ""), keyTouched: true })}
                            />
                          ) : (
                            <p className="input id bg-surface text-slate1">{r.key}</p>
                          )}
                          <span className="block text-[0.75rem] text-slate1 mt-1">
                            {keyEditable(r) ? "Where the answer is stored. Fixed once the form is saved." : "Fixed, so filed reports keep their answers."}
                          </span>
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="label block mb-1.5">Help text</span>
                          <input className="input" value={r.help} onChange={(e) => update(r.uid, { help: e.target.value })} placeholder="Optional guidance under the question" />
                        </label>
                        {isChoice(r.type) && (
                          <label className="block sm:col-span-2">
                            <span className="label block mb-1.5">Options, one per line</span>
                            <textarea
                              className="input"
                              rows={Math.min(Math.max(r.options.length, 3), 10)}
                              value={r.options.join("\n")}
                              onChange={(e) => update(r.uid, { options: e.target.value.split("\n") })}
                            />
                          </label>
                        )}
                        {(r.type === "text" || r.type === "textarea") && (
                          <label className="block">
                            <span className="label block mb-1.5">Character limit</span>
                            <input
                              type="number"
                              min={1}
                              max={10000}
                              className="input"
                              value={r.maxLength ?? ""}
                              onChange={(e) => update(r.uid, { maxLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                              placeholder="No limit"
                            />
                          </label>
                        )}
                        {(r.type === "number" || r.type === "integer") && (
                          <>
                            <label className="block">
                              <span className="label block mb-1.5">Minimum</span>
                              <input type="number" className="input" value={r.minimum ?? ""} onChange={(e) => update(r.uid, { minimum: e.target.value === "" ? undefined : Number(e.target.value) })} />
                            </label>
                            <label className="block">
                              <span className="label block mb-1.5">Maximum</span>
                              <input type="number" className="input" value={r.maximum ?? ""} onChange={(e) => update(r.uid, { maximum: e.target.value === "" ? undefined : Number(e.target.value) })} />
                            </label>
                          </>
                        )}
                        <label className="flex items-center gap-2 text-sm sm:col-span-2">
                          <input type="checkbox" className="accent-chart" checked={r.required} onChange={(e) => update(r.uid, { required: e.target.checked })} />
                          Required
                        </label>
                      </div>
                    )}
                  </div>
                  <InsertHere at={i + 1} />
                  </div>
                );
              })}
            </div>
            {rows.length === 0 && <p className="mt-2 text-sm text-slate1">No fields yet. Add the first one from the menu above, or insert one at a position.</p>}
          </section>

          {/* JSON */}
          <details className="card p-5" onToggle={(e) => e.currentTarget.open && loadJson()}>
            <summary className="font-semibold cursor-pointer">JSON view</summary>
            <p className="text-[0.8125rem] text-slate1 mt-2">
              The whole form as JSON Schema and uiSchema. Use it for what the builder does not cover: conditional
              branches, repeating sections, patterns. See config/forms/README.md for the patterns.
            </p>
            <textarea className="input id mt-3 text-[0.75rem]" rows={18} spellCheck={false} value={jsonText} onChange={(e) => setJsonText(e.target.value)} />
            {jsonError && <p className="mt-2 text-sm text-risk-red">{jsonError}</p>}
            <div className="mt-3 flex gap-2">
              <button type="button" className="btn-ghost" onClick={applyJson}>Apply JSON</button>
              <button type="button" className="btn-ghost" onClick={loadJson}>Reload from the builder</button>
            </div>
          </details>
        </div>

        {/* Preview */}
        <aside className="min-w-0 xl:sticky xl:top-6 self-start">
          <div className="card p-5">
            <p className="label">Preview</p>
            <p className="text-[0.8125rem] text-slate1 mt-0.5">What {visibleTo} will see. Nothing here is submitted.</p>
            <div className="mt-4 border-t border-line pt-4">
              <p className="id text-slate1">{meta.code || "CODE"}</p>
              <p className="text-lg font-semibold">{meta.title || "Untitled form"}</p>
              {meta.summary && <p className="text-sm text-slate1 mt-0.5">{meta.summary}</p>}
              <div className="mt-4">
                <PreviewBoundary key={JSON.stringify(built.schema) + JSON.stringify(built.uiSchema)}>
                  <SmsForm
                    schema={built.schema}
                    uiSchema={built.uiSchema}
                    formData={previewData}
                    identity={{ name: "Priya Nair", email: "priya.nair@demo.contrail", staffNo: "40218866", department: "Flight Operations" }}
                    onChange={setPreviewData}
                  />
                </PreviewBoundary>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

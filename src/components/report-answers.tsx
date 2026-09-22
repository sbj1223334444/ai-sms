"use client";
import { useState } from "react";
import type { Report } from "@/lib/types";
import { LOCKED_FIELDS, answersBySection, reportEditable, withClears } from "@/lib/report-edit";
import SmsForm, { type Identity } from "@/components/sms-form";
import { AirproxDiagram, type AirproxMarks } from "@/components/airprox-diagram";

type Json = Record<string, unknown>;

interface Props {
  report: Report;
  form: { schema: Json; uiSchema: Json } | null;
  canEdit: boolean;
  busy: boolean;
  onSave: (data: Json) => Promise<{ ok: boolean }>;
}

/** The airprox diagram is drawn, not listed (see components/airprox-diagram). */
function isDiagram(key: string, v: unknown): v is AirproxMarks {
  return key === "airproxDiagram" && typeof v === "object" && v !== null;
}

function show(v: unknown): React.ReactNode {
  if (Array.isArray(v)) {
    if (v.every((x) => typeof x !== "object")) return v.join(", ");
    return (
      <ul className="space-y-1">
        {v.map((item, i) => (
          <li key={i}>
            {Object.entries(item as Json)
              .filter(([, x]) => x !== undefined && x !== "")
              .map(([k, x]) => `${k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${x}`)
              .join(" · ")}
          </li>
        ))}
      </ul>
    );
  }
  if (typeof v === "object" && v !== null) return JSON.stringify(v);
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.replace("T", " ").slice(0, 16) + " UTC" : s;
}

function Answers({ data, form, identity }: { data: Json; form: Props["form"]; identity: Identity | null }) {
  const sections = answersBySection(form, data);
  if (!sections.length && !identity) return <p className="text-sm text-slate1">No answers recorded.</p>;
  const common: [string, string][] = identity
    ? [["Name", identity.name], ["Email ID", identity.email], ["Staff number", identity.staffNo], ["Department", identity.department]]
    : [];
  return (
    <div className="space-y-6">
      {identity && (
        <section>
          <h3 className="eyebrow mb-2">Reporter</h3>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {common.filter(([, v]) => v).map(([label, value]) => (
              <div key={label} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                <dt className="text-slate1">{label}</dt>
                <dd className="font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-1.5 text-[0.75rem] text-slate1">From the reporter&apos;s account at submission. Not editable.</p>
        </section>
      )}
      {sections.map((s) => (
        <section key={s.title}>
          <h3 className="eyebrow mb-2">{s.title}</h3>
          <dl className="divide-y divide-line rounded-xl border border-line">
            {s.rows.map((r) =>
              isDiagram(r.key, r.value) ? (
                <div key={r.key} className="px-4 py-3">
                  <p className="text-sm text-slate1 mb-2">{r.label}</p>
                  <AirproxDiagram value={r.value} readOnly />
                </div>
              ) : (
                <div key={r.key} className="grid gap-1 px-4 py-2.5 text-sm sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                  <dt className="text-slate1">{r.label}</dt>
                  <dd className="whitespace-pre-line break-words font-medium text-ink">{show(r.value)}</dd>
                </div>
              )
            )}
          </dl>
        </section>
      ))}
    </div>
  );
}

/**
 * The reporter's answers on the Report details tab (US-04 criteria 3, 12, 13). Investigators and the
 * other roles with report.editSubmitted can correct them on an Investigation + SRA report. Identity
 * and the confidentiality choice stay fixed; every change goes to the Timeline; the original
 * submission stays viewable.
 */
export default function ReportAnswers({ report, form, canEdit, busy, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [draft, setDraft] = useState<Json>(report.data);
  const editable = canEdit && reportEditable(report) && Boolean(form);
  // BRD 6: the common fields come from the reporter's account, and are absent on a confidential report.
  const who = report.submittedBy;
  const identity = report.confidential
    ? { name: "Confidential", email: "", staffNo: "", department: "" }
    : who
      ? { name: who.name, email: who.email, staffNo: who.staffNo, department: who.department }
      : null;
  const props = (form?.schema.properties ?? {}) as Record<string, Json>;
  const edits = report.edits ?? [];

  const uiSchema = form
    ? { ...form.uiSchema, ...Object.fromEntries(LOCKED_FIELDS.filter((k) => k in props).map((k) => [k, { ...((form.uiSchema[k] as Json) ?? {}), "ui:disabled": true }])) }
    : {};

  async function save(data: Json) {
    const res = await onSave(withClears(report.data, data));
    if (res.ok) setEditing(false);
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{showOriginal ? "Original submission" : "Submitted report"}</h2>
          {edits.length > 0 && (
            <p className="mt-0.5 text-[0.8125rem] text-slate1">
              Edited {edits.length} time{edits.length === 1 ? "" : "s"}, last by {edits[edits.length - 1].by}
              {edits[edits.length - 1].viaTask && ` through task ${edits[edits.length - 1].viaTask}`}. Every change is on the Timeline.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {report.originalData && !editing && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => setShowOriginal(!showOriginal)}>
              {showOriginal ? "Show current answers" : "Show original answers"}
            </button>
          )}
          {editable && !editing && !showOriginal && (
            <button type="button" className="btn-primary btn-sm" onClick={() => { setDraft(report.data); setEditing(true); }}>
              Edit answers
            </button>
          )}
        </div>
      </div>

      {editing && form ? (
        <>
          <p className="mb-5 rounded-xl border border-chart/15 bg-chartsoft/60 p-3.5 text-[0.8125rem] leading-relaxed text-ink">
            You are correcting the reporter&apos;s answers. The reporter&apos;s name, staff number, email and department, the report
            ID, the submission date and the confidentiality choice cannot be changed. Each changed field is recorded on the
            Timeline with its old and new value, and the original submission is kept.
          </p>
          <SmsForm
            schema={form.schema}
            uiSchema={uiSchema}
            formData={draft}
            identity={identity}
            identityWithheld={report.confidential}
            onChange={setDraft}
            onSubmit={save}
          >
            <div className="sticky bottom-4 z-10 mt-5 flex gap-2 rounded-2xl border border-line bg-white/95 p-3 shadow-lift backdrop-blur">
              <button type="submit" className="btn-primary" disabled={busy}>{busy ? "Saving" : "Save changes"}</button>
              <button type="button" className="btn-ghost" disabled={busy} onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </SmsForm>
        </>
      ) : (
        <Answers data={showOriginal && report.originalData ? report.originalData : report.data} form={form} identity={identity} />
      )}

      {canEdit && !editable && report.triage && report.triage.decision !== "investigation_sra" && (
        <p className="mt-4 text-[0.8125rem] text-slate1">Read-only: only reports accepted for Investigation + SRA can have their answers edited (US-04).</p>
      )}
    </div>
  );
}

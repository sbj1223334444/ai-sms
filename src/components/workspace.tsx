"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Assignee, Report, Task, TaskType, Sra, Finding } from "@/lib/types";
import { StatusBadge } from "@/components/ui";
import { RiskChip } from "@/components/risk-matrix";
import PersonPicker from "@/components/person-picker";
import StageListEditor, { type EditableStage } from "@/components/stage-list-editor";
import ReportAnswers from "@/components/report-answers";
import SraPanel from "@/components/sra-panel";
import { NewTaskForm, TaskItem } from "@/components/task-workspace";
import { lockedReason } from "@/lib/workflow";
import { editableSections, type EditableSection } from "@/lib/report-edit";
import { normaliseSra, sraContents } from "@/lib/sra";
import { TASK_STATUS_LABEL, isTaskOpen } from "@/lib/tasks";
import investigationCfg from "@config/investigation-fields.json";

type FormShape = { schema: Record<string, unknown>; uiSchema: Record<string, unknown> };

interface Props {
  report: Report;
  tasks: Task[];
  me: { name: string; email: string; role: string };
  /** Set when the report is assigned to someone else: they do the work, you read it. */
  holder: { email: string; name: string } | null;
  permissions: Record<string, boolean>;
  investigators: Assignee[];
  /** Everyone a task can be assigned to. */
  directory: Assignee[];
  /** The report's form, for editing its answers and choosing task edit sections. */
  form: FormShape | null;
}

export default function Workspace({ report: initial, tasks, me, holder, permissions, investigators, directory, form }: Props) {
  const router = useRouter();
  const [report, setReport] = useState(initial);
  // Task actions refresh the page rather than returning the report, so take the server's copy when
  // it arrives, but never one older than what is on screen: every change adds a timeline entry, and
  // a stale copy must not undo a save the API has just confirmed.
  useEffect(() => setReport((cur) => (initial.timeline.length >= cur.timeline.length ? initial : cur)), [initial]);
  const [tab, setTab] = useState("details");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isInvestigationSra = report.triage?.decision === "investigation_sra";

  // Check if user has task-based edit access to specific sections
  const myTaskWithEditAccess = tasks.find(t => t.assignee === me.email && t.formEditAccess && isTaskOpen(t.status));
  const allowedSections = myTaskWithEditAccess?.editableSections ?? [];

  // Function to check if a section can be edited
  const canEditSection = (sectionKey: string): boolean => {
    // Full edit permission (assigned investigator or admin)
    if (permissions.editReport || permissions.investigate) return true;
    // Task-based section edit permission
    if (myTaskWithEditAccess && allowedSections.includes(sectionKey)) return true;
    return false;
  };

  // An SRA tab exists only where an assessment does: one per finding flagged for assessment on an
  // Investigation + SRA report, one on an SRA-only report, none on a database-only one (US-05).
  const sras = report.sras.map((s, i) => normaliseSra(s, i));
  const tabs = [
    { key: "details", label: "Report details" },
    ...(isInvestigationSra ? [{ key: "investigation", label: "Investigation" }] : []),
    ...sras.map((s, i) => ({
      key: `sra-${s.id}`,
      label: s.findingRef ? `SRA ${i + 1} · ${s.title.slice(0, 20)}${s.title.length > 20 ? "…" : ""}` : "SRA"
    })),
    { key: "workflow", label: "Workflow" },
    { key: "timeline", label: "Timeline" }
  ];

  // A finding can lose its assessment while its tab is open, so never sit on a tab that has gone.
  useEffect(() => {
    if (!tabs.some((t) => t.key === tab)) setTab(isInvestigationSra ? "investigation" : "details");
  }, [tabs, tab, isInvestigationSra]);

  async function call(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch(`/api/reports/${report.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.blockers ? `${data.error}: ${data.blockers.join("; ")}` : data.warn ?? data.error);
      return { ok: false, data };
    }
    setReport(data.report);
    router.refresh();
    return { ok: true, data };
  }

  return (
    <>
      <a href="/queue" className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate1 hover:text-ink">
        <span aria-hidden="true">←</span> Active queue
      </a>
      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip id font-semibold text-ink">{report.safetyRef ?? report.id}</span>
              {report.safetyRef && <span className="chip id">{report.id}</span>}
              <StatusBadge status={report.status} />
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">{report.formTitle}</h1>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[0.8125rem]">
              <div><dt className="inline text-slate1">Filed </dt><dd className="inline font-medium">{new Date(report.submittedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</dd></div>
              <div><dt className="inline text-slate1">By </dt><dd className="inline font-medium">{report.confidential ? "Confidential reporter" : report.submittedBy?.name}</dd></div>
              {report.triage?.investigator && <div><dt className="inline text-slate1">Investigator </dt><dd className="inline font-medium">{report.triage.investigator}</dd></div>}
              {report.triage && <div><dt className="inline text-slate1">Accepted for </dt><dd className="inline font-medium">{report.triage.decision === "investigation_sra" ? "Investigation + SRA" : report.triage.decision === "sra_only" ? "SRA only" : report.triage.decision === "database_only" ? "Database only" : "Rejected"}</dd></div>}
            </dl>
          </div>
          {permissions.extract && (
            <a href={`/report/${report.id}/print`} target="_blank" className="btn-ghost">Extract report</a>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-risk-red/20 bg-red-50 p-3.5 text-sm text-risk-red" role="alert">{error}</div>
      )}
      {notice && (
        <div className="mt-4 rounded-xl border border-amber-300/50 bg-amber-50 p-3.5 text-sm text-amber-900">{notice}</div>
      )}

      {!report.triage && permissions.triage && <Triage onSubmit={call} busy={busy} people={investigators} myEmail={me.email} />}

      {holder && (
        <Handover
          holder={holder}
          canReassign={Boolean(permissions.reassign)}
          people={investigators}
          myEmail={me.email}
          busy={busy}
          onReassign={(investigator, comment) => call({ action: "reassign", investigator, comment })}
        />
      )}

      <nav className="mt-6 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-xs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${
              tab === t.key ? "bg-chart text-white shadow-sm" : "text-slate1 hover:bg-surface hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="py-6">
        {tab === "details" && (
          <Details
            report={report}
            form={form}
            canEdit={canEditSection("details")}
            busy={busy}
            onSaveAnswers={(data) => call({ action: "editReport", data })}
            onSaveCrew={(aircraft, crew) => call({ action: "saveAircraftAndCrew", aircraft, crew })}
          />
        )}
        {tab === "investigation" && (
          <Investigation report={report} sras={sras} canEdit={canEditSection("investigation")} onSave={(inv) => call({ action: "saveInvestigation", investigation: inv })} busy={busy} />
        )}
        {tab.startsWith("sra-") && sras.some((s) => `sra-${s.id}` === tab) && (
          <SraPanel
            key={tab}
            report={report}
            sra={sras.find((s) => `sra-${s.id}` === tab)!}
            me={me}
            directory={directory}
            canEdit={canEditSection("sra")}
            busy={busy}
            onSave={async (sra, confirmSeverity) => {
              const res = await call({ action: "saveSra", sra: confirmSeverity ? { ...sra, severityOverrideAccepted: true } : sra });
              if (!res.ok && res.data.requiresConfirmation) setNotice(res.data.warn);
              return res;
            }}
            onDecide={(sraId, decision, comment) => call({ action: "decideRisk", sraId, decision, comment })}
          />
        )}
        {tab === "workflow" && (
          <WorkflowPanel
            report={report}
            tasks={tasks}
            permissions={permissions}
            busy={busy}
            me={me}
            directory={directory}
            sections={form ? editableSections(form) : []}
            onTasksChanged={() => router.refresh()}
            onComplete={(stageKey, response) => call({ action: "completeStage", stageKey, response })}
            onEditStages={(stages) => call({ action: "editStages", stages })}
            onReopen={(stageKey, reason) => call({ action: "reopenStage", stageKey, reason })}
            onClosure={(signOff, followUp) => call({ action: "submitClosure", signOff, followUp })}
            onGatekeeper={(decision, comment) => call({ action: "gatekeeperDecision", decision, comment })}
            onCofs={(decision, comment) => call({ action: "cofsDecision", decision, comment })}
          />
        )}
        {tab === "timeline" && <Timeline report={report} />}
      </div>
    </>
  );
}

/* ---------------- Who holds this report ---------------- */
/**
 * Once a report is assigned, the work is the assignee's. Anyone else with access reads it, and a
 * gatekeeper can hand it to someone else from here.
 */
function Handover({
  holder, canReassign, people, myEmail, busy, onReassign
}: {
  holder: { email: string; name: string };
  canReassign: boolean;
  people: Assignee[];
  myEmail: string;
  busy: boolean;
  onReassign: (investigator: string, comment: string) => Promise<{ ok: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  const [investigator, setInvestigator] = useState("");
  const [comment, setComment] = useState("");

  return (
    <div className="mt-5 card border-chart/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">Assigned to {holder.name}</p>
          <p className="mt-0.5 text-[0.8125rem] text-slate1">
            They carry out the investigation, the risk assessment and the tasks on this report. You can read all of it,
            and everything that happens is on the Timeline.
          </p>
        </div>
        {canReassign && !open && (
          <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>Reassign</button>
        )}
      </div>

      {open && (
        <div className="mt-4 border-t border-line pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="reassign-to" className="label mb-1.5 block">Hand it to</label>
              <PersonPicker id="reassign-to" people={people} value={investigator} myEmail={myEmail} onChange={setInvestigator} />
            </div>
            <label className="block">
              <span className="label mb-1.5 block">Why (optional)</span>
              <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="On leave, workload, expertise" />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || !investigator}
              onClick={async () => {
                const res = await onReassign(investigator, comment);
                if (res.ok) setOpen(false);
              }}
            >
              {busy ? "Reassigning" : "Reassign"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------- Triage ---------------- */
function Triage({
  onSubmit,
  busy,
  people,
  myEmail
}: {
  onSubmit: (b: Record<string, unknown>) => Promise<{ ok: boolean }>;
  busy: boolean;
  people: Assignee[];
  myEmail: string;
}) {
  const [decision, setDecision] = useState("investigation_sra");
  const [investigator, setInvestigator] = useState("");
  const [comment, setComment] = useState("");
  const [hazard, setHazard] = useState(false);

  return (
    <div className="card p-5 mt-5 border-chart/30">
      <p className="font-medium">This report is waiting for your decision</p>
      <p className="text-[0.8125rem] text-slate1 mt-1">
        Accepting issues a safety reference number. Rejected reports never enter that series.
      </p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="label block mb-1.5">Decision</span>
          <select className="input" value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="investigation_sra">Accept for investigation and SRA</option>
            <option value="sra_only">Accept for SRA only</option>
            <option value="database_only">Accept for database only</option>
            <option value="reject">Reject</option>
          </select>
        </label>
        {decision !== "reject" && (
          <div>
            <label htmlFor="triage-investigator" className="label block mb-1.5">Investigator or SMS nodal</label>
            <PersonPicker
              id="triage-investigator"
              people={people}
              value={investigator}
              myEmail={myEmail}
              onChange={setInvestigator}
            />
          </div>
        )}
      </div>
      {decision !== "reject" && (
        <label className="flex items-center gap-2 mt-3 text-sm">
          <input type="checkbox" className="accent-chart" checked={hazard} onChange={(e) => setHazard(e.target.checked)} />
          This is an operational hazard
        </label>
      )}
      <label className="block mt-4">
        <span className="label block mb-1.5">
          Comment {decision === "reject" && <span className="text-risk-red">required when rejecting</span>}
        </span>
        <textarea className="input" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
      </label>
      <button
        className="btn-primary mt-4"
        disabled={busy}
        onClick={() => onSubmit({ action: "triage", decision, investigator, comment, operationalHazard: hazard })}
      >
        {decision === "reject" ? "Reject report" : "Accept and assign"}
      </button>
    </div>
  );
}

/* ---------------- Report details ---------------- */
function Details({
  report, form, canEdit, busy, onSaveAnswers, onSaveCrew
}: {
  report: Report;
  form: FormShape | null;
  canEdit: boolean;
  busy: boolean;
  onSaveAnswers: (data: Record<string, unknown>) => Promise<{ ok: boolean }>;
  onSaveCrew: (a: unknown, c: unknown) => void;
}) {
  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 card p-5">
        <ReportAnswers report={report} form={form} canEdit={canEdit} busy={busy} onSave={onSaveAnswers} />
        {report.attachments.length > 0 && (
          <>
            <h3 className="label mt-5 mb-2">Attachments</h3>
            <ul className="text-sm space-y-1">
              {report.attachments.map((a, i) => <li key={i}>{a.name}</li>)}
            </ul>
          </>
        )}
      </div>

      <div className="space-y-5">
        <CrewAndAircraft report={report} onSave={(aircraft, crew) => onSaveCrew(aircraft, crew)} />

        {report.triage && (
          <div className="card p-5">
            <h2 className="font-semibold">Triage</h2>
            <dl className="mt-3 text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-slate1">Decision</dt><dd>{report.triage.decision.replace(/_/g, " ")}</dd></div>
              <div className="flex justify-between"><dt className="text-slate1">By</dt><dd>{report.triage.by}</dd></div>
              {report.triage.investigator && (
                <div className="flex justify-between"><dt className="text-slate1">Assigned</dt><dd>{report.triage.investigator}</dd></div>
              )}
            </dl>
            {report.triage.comment && <p className="mt-3 text-sm border-t border-line pt-3">{report.triage.comment}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Crew and aircraft ---------------- */
function CrewAndAircraft({ report, onSave }: { report: Report; onSave: (a: unknown, c: unknown) => void }) {
  const [edit, setEdit] = useState(false);
  const [aircraft, setAircraft] = useState(report.cae?.aircraft ?? { type: "", registration: "", configuration: "" });
  const [crew, setCrew] = useState(report.cae?.crew ?? []);
  const flightRelated = Boolean(report.data.flightNo);
  // Forms name the date differently; take the flight date first, then the occurrence date.
  const flightDate = ["flightDate", "dateOfOccurrence", "dateOfEvent", "dateOfIncident"].map((k) => report.data[k]).find(Boolean);

  if (!edit) {
    return (
      <div className="card p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-semibold">Crew and aircraft</h2>
          <button className="text-[0.8125rem] text-chart font-medium" onClick={() => setEdit(true)}>
            {report.cae?.aircraft?.registration ? "Edit" : "Add details"}
          </button>
        </div>
        {!flightRelated && <p className="text-sm text-slate1 mt-2">This report is not flight related.</p>}
        {flightRelated && !report.cae?.aircraft?.registration && (
          <p className="text-sm text-slate1 mt-2">
            Not recorded yet. Take these from the tech log or the movement sheet for flight{" "}
            <span className="id">{String(report.data.flightNo)}</span>{flightDate ? ` on ${String(flightDate)}` : ""}.
          </p>
        )}
        {report.cae?.aircraft?.registration && (
          <dl className="mt-3 text-sm space-y-1.5">
            <div className="flex justify-between"><dt className="text-slate1">Type</dt><dd>{report.cae.aircraft.type}</dd></div>
            <div className="flex justify-between"><dt className="text-slate1">Registration</dt><dd className="id">{report.cae.aircraft.registration}</dd></div>
            {report.cae.aircraft.configuration && (
              <div className="flex justify-between"><dt className="text-slate1">Configuration</dt><dd className="id">{report.cae.aircraft.configuration}</dd></div>
            )}
          </dl>
        )}
        {(report.cae?.crew ?? []).length > 0 && (
          <ul className="mt-4 space-y-2 text-sm">
            {report.cae!.crew!.map((c, i) => (
              <li key={i} className="border-t border-line pt-2">
                <p className="font-medium">{c.name}</p>
                <p className="text-slate1 text-[0.8125rem]">{[c.role, c.licence, c.base].filter(Boolean).join(" · ")}</p>
              </li>
            ))}
          </ul>
        )}
        {report.cae?.fetchedAt && (
          <p className="mt-3 text-[0.75rem] text-slate1">Entered manually on {new Date(report.cae.fetchedAt).toLocaleDateString("en-IN")}.</p>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5">
      <h2 className="font-semibold">Crew and aircraft</h2>
      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="label block mb-1.5">Aircraft type</span>
          <input className="input" value={aircraft.type} onChange={(e) => setAircraft({ ...aircraft, type: e.target.value })} placeholder="A320neo" />
        </label>
        <label className="block">
          <span className="label block mb-1.5">Registration</span>
          <input className="input" value={aircraft.registration} onChange={(e) => setAircraft({ ...aircraft, registration: e.target.value })} placeholder="VT-EXQ" />
        </label>
        <label className="block">
          <span className="label block mb-1.5">Configuration</span>
          <input className="input" value={aircraft.configuration} onChange={(e) => setAircraft({ ...aircraft, configuration: e.target.value })} placeholder="C8Y162" />
        </label>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between">
          <span className="label">Crew</span>
          <button className="text-[0.8125rem] text-chart font-medium"
            onClick={() => setCrew([...crew, { name: "", role: "", licence: "", base: "" }])}>
            Add crew member
          </button>
        </div>
        {crew.map((c, i) => (
          <div key={i} className="border border-line rounded p-3 mt-2 bg-surface space-y-2">
            <input className="input" placeholder="Name" value={c.name}
              onChange={(e) => setCrew(crew.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <div className="grid grid-cols-2 gap-2">
              <input className="input" placeholder="Role" value={c.role}
                onChange={(e) => setCrew(crew.map((x, j) => (j === i ? { ...x, role: e.target.value } : x)))} />
              <input className="input" placeholder="Base" value={c.base}
                onChange={(e) => setCrew(crew.map((x, j) => (j === i ? { ...x, base: e.target.value } : x)))} />
            </div>
            <input className="input" placeholder="Licence number" value={c.licence}
              onChange={(e) => setCrew(crew.map((x, j) => (j === i ? { ...x, licence: e.target.value } : x)))} />
            <button className="text-[0.8125rem] text-risk-red" onClick={() => setCrew(crew.filter((_, j) => j !== i))}>Remove</button>
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={() => { onSave(aircraft, crew); setEdit(false); }}>Save details</button>
        <button className="btn-ghost" onClick={() => setEdit(false)}>Cancel</button>
      </div>
    </div>
  );
}

/* ---------------- Investigation ---------------- */
function Investigation({ report, sras, canEdit, onSave, busy }: { report: Report; sras: Sra[]; canEdit: boolean; onSave: (i: unknown) => void; busy: boolean }) {
  const [inv, setInv] = useState(report.investigation ?? { findings: [] as Finding[], factual: {} as Record<string, string> });
  const findings = inv.findings ?? [];

  function setField(key: string, value: string) {
    setInv({ ...inv, [key]: value });
  }
  function setFactual(key: string, value: string) {
    setInv({ ...inv, factual: { ...(inv.factual ?? {}), [key]: value } });
  }
  function updateFinding(id: string, patch: Partial<Finding>) {
    setInv({ ...inv, findings: findings.map((f) => (f.id === id ? { ...f, ...patch } : f)) });
  }

  /**
   * The SRA tab for a finding lives and dies with the flag (US-05 criterion 3), so say what is
   * about to go before it goes. Nothing is lost until the investigation is saved.
   */
  function confirmLosingSra(f: Finding, what: string): boolean {
    const sra = sras.find((s) => s.findingRef === f.id);
    if (!sra) return true;
    const held = sraContents(sra);
    if (!held.length) return true;
    return window.confirm(
      `${what} deletes its safety risk assessment, along with ${held.join(", ")}.

This cannot be undone once you save the investigation. Continue?`
    );
  }

  function setSraRequired(f: Finding, on: boolean) {
    if (!on && !confirmLosingSra(f, "Unticking this")) return;
    updateFinding(f.id, { sraRequired: on });
  }

  function removeFinding(f: Finding) {
    if (!confirmLosingSra(f, "Removing this finding")) return;
    setInv({ ...inv, findings: findings.filter((x) => x.id !== f.id) });
  }

  /** Finding references never repeat, even after one in the middle is removed. */
  function addFinding() {
    const used = findings.map((f) => Number(/^F(\d+)$/.exec(f.id)?.[1] ?? 0));
    const next = Math.max(0, ...used) + 1;
    setInv({ ...inv, findings: [...findings, { id: `F${next}`, text: "", sraRequired: false }] });
  }

  return (
    <fieldset disabled={!canEdit} className="max-w-3xl border-0 p-0 m-0 disabled:opacity-100">
      {investigationCfg.sections.map((s) =>
        s.children ? (
          <section key={s.key} className="card p-5 mb-4">
            <h2 className="font-semibold">{s.no} {s.label}</h2>
            <p className="text-[0.8125rem] text-slate1 mt-0.5 mb-4">Fill in what applies. None of these are mandatory.</p>
            {s.children.map((c) => (
              <label key={c.key} className="block mb-4">
                <span className="label block mb-1.5">{c.no} {c.label}</span>
                <textarea
                  className="input"
                  rows={2}
                  value={(inv.factual ?? {})[c.key] ?? ""}
                  onChange={(e) => setFactual(c.key, e.target.value)}
                />
              </label>
            ))}
          </section>
        ) : (
          <section key={s.key} className="card p-5 mb-4">
            <label className="block">
              <span className="label block mb-1.5">
                {s.no} {s.label} {s.required && <span className="text-risk-red">required</span>}
              </span>
              <textarea
                className="input"
                rows={4}
                value={(inv as unknown as Record<string, string>)[s.key] ?? ""}
                onChange={(e) => setField(s.key, e.target.value)}
              />
            </label>
          </section>
        )
      )}

      <section className="card p-5 mb-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">4. Findings and actions</h2>
          <span className="text-[0.8125rem] text-slate1">{findings.length} of {investigationCfg.maxFindings}</span>
        </div>
        <p className="text-[0.8125rem] text-slate1 mt-0.5">
          Flagging a finding for risk assessment opens an SRA tab named after it when you save. Unticking it, or removing
          the finding, deletes that assessment and everything in it.
        </p>

        {findings.map((f, i) => (
          <div key={f.id} className="border border-line rounded p-4 mt-4 bg-surface">
            <div className="flex items-start justify-between gap-3">
              <span className="label">Finding {i + 1}</span>
              <button className="text-[0.8125rem] text-risk-red" onClick={() => removeFinding(f)}>Remove</button>
            </div>
            <textarea className="input mt-2" rows={2} value={f.text} placeholder="What did the investigation find?"
              onChange={(e) => updateFinding(f.id, { text: e.target.value })} />
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <label className="block">
                <span className="label block mb-1.5">Control state</span>
                <select className="input" value={f.state ?? ""} onChange={(e) => updateFinding(f.id, { state: e.target.value })}>
                  <option value="">Select</option>
                  {investigationCfg.findingStates.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2.5 text-sm">
                <input type="checkbox" className="accent-chart" checked={f.sraRequired}
                  onChange={(e) => setSraRequired(f, e.target.checked)} />
                Needs a safety risk assessment
              </label>
            </div>
            <label className="block mt-3">
              <span className="label block mb-1.5">4.2 Root cause</span>
              <textarea className="input" rows={2} value={f.rootCause ?? ""} onChange={(e) => updateFinding(f.id, { rootCause: e.target.value })} />
            </label>
            <label className="block mt-3">
              <span className="label block mb-1.5">4.3 Actions</span>
              <textarea className="input" rows={2} value={f.actions ?? ""} onChange={(e) => updateFinding(f.id, { actions: e.target.value })} />
            </label>
          </div>
        ))}

        <button className="btn-ghost mt-4" disabled={findings.length >= investigationCfg.maxFindings} onClick={addFinding}>
          Add a finding
        </button>
      </section>

      {canEdit ? (
        <button className="btn-primary" disabled={busy} onClick={() => onSave(inv)}>
          {busy ? "Saving" : "Save investigation"}
        </button>
      ) : (
        <p className="text-[0.8125rem] text-slate1">
          Read-only: the investigation belongs to whoever the report is assigned to.
        </p>
      )}
    </fieldset>
  );
}

/* ---------------- Workflow and closure ---------------- */
function WorkflowPanel({
  report, tasks, permissions, busy, me, directory, sections, onTasksChanged, onComplete, onEditStages, onReopen, onClosure, onGatekeeper, onCofs
}: {
  report: Report;
  tasks: Task[];
  permissions: Record<string, boolean>;
  busy: boolean;
  me: { name: string; email: string; role: string };
  directory: Assignee[];
  sections: EditableSection[];
  onTasksChanged: () => void;
  onComplete: (k: string, r: string) => void;
  onEditStages: (stages: { key: string; name: string; taskDays: number }[]) => Promise<{ ok: boolean }>;
  onReopen: (stageKey: string, reason: string) => Promise<{ ok: boolean }>;
  onClosure: (s: string, f: string) => void;
  onGatekeeper: (d: string, c: string) => void;
  onCofs: (d: string, c: string) => void;
}) {
  const [response, setResponse] = useState("");
  const [signOff, setSignOff] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState<EditableStage[] | null>(null);
  const [newTask, setNewTask] = useState<{ type: TaskType; stageKey: string } | null>(null);
  const [reopening, setReopening] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const today = new Date().toISOString().slice(0, 10);
  const canEdit = permissions.editStages && report.status === "in_progress";
  const canReopen = permissions.work && report.status === "in_progress";
  const canRaise = permissions.createTask && ["in_progress", "pending_risk_approval"].includes(report.status);
  const current = report.workflow.find((s) => s.status === "in_progress")?.key ?? "";
  const reporterReachable = !report.confidential && Boolean(report.submittedBy);
  // Whoever raised a task, and whoever holds the report, can review it, change it or delete it.
  const canManage = (t: Task) => t.createdBy === me.email || report.triage?.investigator === me.email;
  const openTasks = tasks.filter((t) => isTaskOpen(t.status)).length;

  function raise(type: TaskType, stageKey = current) {
    setNewTask({ type, stageKey });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditing() {
    setEditing(
      report.workflow.map((s) => {
        const locked = lockedReason(s);
        return { id: s.key, key: s.key, name: s.name, taskDays: s.taskDays, pinned: locked ?? undefined, readOnly: Boolean(locked), note: `Target ${s.targetDate}` };
      })
    );
  }

  async function saveStages() {
    if (!editing) return;
    const res = await onEditStages(editing.map(({ key, name, taskDays }) => ({ key, name, taskDays })));
    if (res.ok) setEditing(null);
  }

  if (editing) {
    return (
      <div className="max-w-3xl">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="font-semibold">Edit stages on this report</h3>
            <p className="text-[0.8125rem] text-slate1 mt-0.5">
              Stages that have not started can be renamed, re-timed, removed or reordered, and new ones added before Closure Approval.
              Target dates are recalculated when you save. The workflow for this report type does not change.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
            <button type="button" className="btn-primary" disabled={busy} onClick={saveStages}>{busy ? "Saving" : "Save stages"}</button>
          </div>
        </div>
        <div className="mt-4">
          <StageListEditor stages={editing} onChange={setEditing} disabled={busy} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-3">
        {(canRaise || canEdit) && (
          <div className="flex flex-wrap justify-end gap-2">
            {canRaise && (
              <>
                <button type="button" className="btn-ghost" onClick={() => raise(reporterReachable ? "reporter_info" : "company_info")}>
                  Ask for information
                </button>
                <button type="button" className="btn-ghost" onClick={() => raise("action")}>Add task</button>
              </>
            )}
            {canEdit && <button type="button" className="btn-ghost" onClick={startEditing}>Edit stages</button>}
          </div>
        )}
        {newTask && (
          <NewTaskForm
            key={`${newTask.type}-${newTask.stageKey}`}
            report={report}
            directory={directory}
            sections={sections}
            myEmail={me.email}
            initialType={newTask.type}
            initialStage={newTask.stageKey}
            onDone={(created) => {
              setNewTask(null);
              if (created) onTasksChanged();
            }}
          />
        )}
        {report.workflow.map((s) => {
          const overdue = s.status !== "complete" && s.targetDate < today;
          const stageTasks = tasks.filter((t) => t.stageKey === s.key);
          return (
            <div key={s.key} className={`card p-4 ${s.status === "in_progress" ? "border-chart" : ""}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-[0.8125rem] text-slate1 mt-0.5">
                    {s.taskDays} day{s.taskDays > 1 ? "s" : ""} · target {s.targetDate}
                    {overdue && <span className="text-risk-red font-medium"> · overdue</span>}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {canRaise && s.status !== "complete" && (
                    <button type="button" className="text-[0.8125rem] text-chart font-medium" onClick={() => raise("action", s.key)}>
                      Assign task
                    </button>
                  )}
                  {canReopen && s.status === "complete" && s.key !== "closure" && (
                    <button
                      type="button"
                      className="text-[0.8125rem] font-medium text-chart"
                      onClick={() => { setReopening(reopening === s.key ? null : s.key); setReason(""); }}
                    >
                      Reopen
                    </button>
                  )}
                  <span className="text-[0.8125rem] text-slate1">
                    {s.status === "complete" ? "Complete" : s.status === "in_progress" ? "In progress" : "Not started"}
                  </span>
                </div>
              </div>
              {reopening === s.key && (
                <div className="mt-3 rounded-xl border border-chart/30 bg-chartsoft/40 p-3">
                  <p className="text-[0.8125rem] text-slate1">
                    Reopening puts this stage back in progress. Anything already written at it is kept, and every stage
                    after it starts again.
                  </p>
                  <textarea
                    className="input mt-2"
                    rows={2}
                    placeholder="Why is it being reopened? This goes on the Timeline."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={busy || !reason.trim()}
                      onClick={async () => {
                        const res = await onReopen(s.key, reason);
                        if (res.ok) { setReopening(null); setReason(""); }
                      }}
                    >
                      {busy ? "Reopening" : "Reopen stage"}
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setReopening(null)}>Cancel</button>
                  </div>
                </div>
              )}
              {stageTasks.length > 0 && (
                <ul className="mt-3 space-y-2 border-t border-line pt-3">
                  {stageTasks.map((t) => (
                    <li key={t.id}>
                      <TaskItem task={t} canManage={canManage(t)} directory={directory} myEmail={me.email} compact onChanged={onTasksChanged} />
                    </li>
                  ))}
                </ul>
              )}
              {s.response && <p className="text-sm mt-3 border-t border-line pt-3">{s.response}</p>}
              {s.status === "in_progress" && s.key !== "closure" && (
                <div className="mt-3 border-t border-line pt-3">
                  <textarea className="input" rows={2} placeholder="What was done at this stage?" value={response} onChange={(e) => setResponse(e.target.value)} />
                  <button className="btn-ghost mt-2" disabled={busy} onClick={() => onComplete(s.key, response)}>
                    Mark stage complete
                  </button>
                </div>
              )}
            </div>
          );
        })}
        <p className="text-[0.8125rem] text-slate1 pt-1">
          {permissions.editStages
            ? "Stages that have not started can be changed while the report is in progress."
            : "An administrator can add, remove or reorder stages that have not started."}
        </p>
      </div>

      <div className="space-y-5">
        <div className="card p-5">
          <h3 className="font-semibold">Tasks</h3>
          <p className="text-[0.8125rem] text-slate1 mt-0.5">
            {tasks.length === 0 ? "No tasks raised on this report." : `${openTasks} of ${tasks.length} still open. Open tasks block their stage and closure.`}
          </p>
          <ul className="mt-3 space-y-3">
            {tasks.map((t) => (
              <TaskItem key={t.id} task={t} canManage={canManage(t)} directory={directory} myEmail={me.email} onChanged={onTasksChanged} />
            ))}
          </ul>
        </div>

        {report.status === "in_progress" && permissions.sendForApproval && (
          <div className="card p-5">
            <h3 className="font-semibold">Close this report</h3>
            <p className="text-[0.8125rem] text-slate1 mt-1">
              Everything has to be finished first: stages, tasks, investigation, risk assessment and a monitoring period on every control.
            </p>
            <textarea className="input mt-3" rows={2} placeholder="Follow-up requirements" value={followUp} onChange={(e) => setFollowUp(e.target.value)} />
            <textarea className="input mt-2" rows={2} placeholder="Investigator sign-off" value={signOff} onChange={(e) => setSignOff(e.target.value)} />
            <button className="btn-primary mt-3 w-full justify-center" disabled={busy} onClick={() => onClosure(signOff, followUp)}>
              Send for approval
            </button>
          </div>
        )}

        {report.status === "pending_gatekeeper_approval" && permissions.gatekeeperReview && (
          <Decision title="Gatekeeper review" note="Approving sends this to COFS." comment={comment} setComment={setComment}
            onApprove={() => onGatekeeper("approved", comment)} onReject={() => onGatekeeper("rejected", comment)} busy={busy} />
        )}
        {report.status === "pending_cofs_approval" && permissions.approveClosure && (
          <Decision title="COFS approval" note="This is the final decision on closure." comment={comment} setComment={setComment}
            onApprove={() => onCofs("approved", comment)} onReject={() => onCofs("rejected", comment)} busy={busy} />
        )}
        {report.status === "pending_cofs_approval" && !permissions.approveClosure && (
          <div className="card p-5 text-sm text-slate1">Waiting on COFS. Only COFS can approve closure.</div>
        )}
      </div>
    </div>
  );
}

function Decision({ title, note, comment, setComment, onApprove, onReject, busy }: {
  title: string; note: string; comment: string; setComment: (s: string) => void;
  onApprove: () => void; onReject: () => void; busy: boolean;
}) {
  return (
    <div className="card p-5 border-chart/40">
      <h3 className="font-semibold">{title}</h3>
      <p className="text-[0.8125rem] text-slate1 mt-1">{note}</p>
      <textarea className="input mt-3" rows={2} placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" disabled={busy} onClick={onApprove}>Approve</button>
        <button className="btn-danger" disabled={busy} onClick={onReject}>Reject and reopen</button>
      </div>
    </div>
  );
}

/* ---------------- Timeline ---------------- */
function Timeline({ report }: { report: Report }) {
  return (
    <ol className="max-w-2xl">
      {[...report.timeline].reverse().map((t, i) => (
        <li key={i} className="flex gap-4 pb-5 last:pb-0">
          <div className="flex flex-col items-center">
            <span className="mt-1.5 h-2 w-2 rounded-full bg-chart" />
            {i < report.timeline.length - 1 && <span className="w-px flex-1 bg-line" />}
          </div>
          <div className="pb-1">
            <p className="text-sm font-medium">{t.action}</p>
            <p className="text-[0.8125rem] text-slate1">
              {t.actor} · {new Date(t.at).toLocaleString("en-IN")}
            </p>
            {t.detail && <p className="text-sm mt-1">{t.detail}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

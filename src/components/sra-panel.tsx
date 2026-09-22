"use client";
import { useId, useState } from "react";
import type { Assignee, Control, Hazard, Report, Sra } from "@/lib/types";
import RiskMatrix, { RiskChip } from "@/components/risk-matrix";
import PersonPicker from "@/components/person-picker";
import {
  CONTROL_LIBRARY,
  FUNCTIONAL_AREAS,
  HAZARD_REGISTER,
  SRA_REVIEW_PERIODS,
  SRA_STATUSES,
  reviewDateFor
} from "@/lib/sra";
import masters from "@config/masters.json";

interface Props {
  report: Report;
  /** The assessment this tab shows, already normalised by the workspace. */
  sra: Sra;
  me: { email: string; role: string };
  directory: Assignee[];
  /** False when the report is assigned to someone else: the assessment is then read-only. */
  canEdit: boolean;
  busy: boolean;
  onSave: (sra: Sra, confirmSeverity?: boolean) => Promise<{ ok: boolean; data?: Record<string, unknown> }>;
  onDecide: (sraId: string, decision: string, comment: string) => void;
}

/** A dropdown that also takes a new entry, which is how the BRD asks for hazards and controls. */
function Combo({
  label, value, list, placeholder, onChange
}: {
  label: string;
  value: string;
  list: string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const id = useId();
  return (
    <label className="block">
      <span className="label block mb-1.5">{label}</span>
      <input className="input" list={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      <datalist id={id}>
        {list.map((o) => <option key={o} value={o} />)}
      </datalist>
      <span className="block text-[0.75rem] text-slate1 mt-1">Pick one from the list, or type a new one.</span>
    </label>
  );
}

function ControlRows({
  kind, title, note, controls, onChange
}: {
  kind: Control["kind"];
  title: string;
  note: string;
  controls: Control[];
  onChange: (next: Control[]) => void;
}) {
  const mine = controls.map((c, i) => ({ c, i })).filter((x) => x.c.kind === kind);
  const patch = (i: number, p: Partial<Control>) => onChange(controls.map((c, j) => (j === i ? { ...c, ...p } : c)));

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between">
        <span className="label">{title}</span>
        <button
          type="button"
          className="text-[0.8125rem] font-medium text-chart"
          onClick={() => onChange([...controls, { id: "", text: "", kind, monitoringPeriod: "" }])}
        >
          Add
        </button>
      </div>
      <p className="text-[0.75rem] text-slate1 mt-0.5">{note}</p>
      {mine.length === 0 && <p className="mt-2 text-[0.8125rem] text-slate1">None yet.</p>}
      {mine.map(({ c, i }) => (
        <div key={i} className="border border-line rounded-xl p-3 mt-2 bg-surface grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <Combo
              label={c.id ? `Control ${c.id}` : "Control"}
              value={c.text}
              list={CONTROL_LIBRARY}
              placeholder="What is in place, or what will be put in place?"
              onChange={(v) => patch(i, { text: v })}
            />
          </div>
          <div>
            <label className="block">
              <span className="label block mb-1.5">Monitor for</span>
              <select className="input" value={c.monitoringPeriod ?? ""} onChange={(e) => patch(i, { monitoringPeriod: e.target.value })}>
                <option value="">Select</option>
                {masters.effectivenessPeriods.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <button type="button" className="mt-2 text-[0.75rem] text-risk-red" onClick={() => onChange(controls.filter((_, j) => j !== i))}>
              Remove control
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * One safety risk assessment (BRD 7, US-05).
 *
 * The register entry, the risk index, the action and its review describe the assessment as a
 * whole; hazards, each with its existing and additional controls, repeat inside it. Saving is
 * always allowed - the server answers with whatever is still missing for closure.
 */
export default function SraPanel({ report, sra: loaded, me, directory, canEdit, busy, onSave, onDecide }: Props) {
  const [sra, setSra] = useState<Sra>(loaded);
  const [confirmNeeded, setConfirmNeeded] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  const set = (patch: Partial<Sra>) => setSra((s) => ({ ...s, ...patch }));
  const hazards = sra.hazards ?? [];
  const patchHazard = (i: number, patch: Partial<Hazard>) => set({ hazards: hazards.map((h, j) => (j === i ? { ...h, ...patch } : h)) });
  const subFunctions = FUNCTIONAL_AREAS[sra.functionalArea ?? ""] ?? [];
  const pendingOnMe = sra.approval?.status === "pending" && sra.approval.approver === me.email;
  const reviewDate = sra.status === "Closed" ? reviewDateFor(sra.reviewPeriod) ?? sra.reviewDate : undefined;

  /** The reporter's own words, which BRD 7 field 9 starts each hazard description from. */
  function reporterDescription(): string {
    const answers = report.data ?? {};
    for (const key of ["description", "narrative", "eventDescription", "detailsOfOccurrence", "whatHappened"]) {
      const value = answers[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  }

  function addHazard() {
    set({
      hazards: [
        ...hazards,
        { id: "", hazard: "", description: hazards.length === 0 ? reporterDescription() : "", controls: [] }
      ]
    });
  }

  function removeHazard(i: number) {
    const h = hazards[i];
    const filled = h.hazard?.trim() || (h.controls ?? []).length;
    if (filled && !window.confirm(`Remove "${h.hazard || `Hazard ${i + 1}`}" and its controls from this assessment?`)) return;
    set({ hazards: hazards.filter((_, j) => j !== i) });
  }

  async function save(confirmSeverity?: boolean) {
    const res = await onSave({ ...sra, reviewDate }, confirmSeverity);
    if (!res.ok && res.data?.requiresConfirmation) return setConfirmNeeded(true);
    if (res.ok) {
      setConfirmNeeded(false);
      setProblems((res.data?.problems as string[] | undefined) ?? []);
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Everything but the risk acceptance below is the holder's to fill in. */}
      <fieldset disabled={!canEdit} className="border-0 p-0 m-0">
      {/* Register entry: BRD 7 fields 1 to 7 */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-semibold">{sra.title}</h2>
            <p className="text-[0.8125rem] text-slate1 mt-0.5">
              Reference <span className="id">{sra.id}</span> · serial {sra.serial ?? 1} · added to the hazard register{" "}
              {sra.dateAddedToRegister ?? "on save"}
              {sra.findingRef && ` · from finding ${sra.findingRef}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {sra.postMitigation && <RiskChip index={sra.postMitigation} />}
            {sra.approval?.status === "pending" && (
              <span className="rounded bg-risk-orange/10 text-risk-orange border border-risk-orange/30 px-2.5 py-1 text-[0.8125rem]">
                Awaiting acceptance by {sra.approval.approver}
              </span>
            )}
            {sra.approval?.status === "approved" && (
              <span className="rounded bg-risk-green/10 text-risk-green border border-risk-green/30 px-2.5 py-1 text-[0.8125rem]">
                Risk accepted
              </span>
            )}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mt-4">
          <label className="block sm:col-span-2">
            <span className="label block mb-1.5">Source</span>
            <textarea className="input" rows={2} placeholder="Where this assessment came from"
              value={sra.source ?? ""} onChange={(e) => set({ source: e.target.value })} />
          </label>
          <label className="block">
            <span className="label block mb-1.5">Location (ICAO designator)</span>
            <input className="input" placeholder="VIDP" value={sra.location ?? ""} onChange={(e) => set({ location: e.target.value.toUpperCase() })} />
          </label>
          <label className="block">
            <span className="label block mb-1.5">Originator</span>
            <p className="input bg-surface text-slate1">{sra.originator ?? (report.confidential ? "Confidential" : report.submittedBy?.name ?? "Unknown")}</p>
          </label>
          <label className="block">
            <span className="label block mb-1.5">Functional area</span>
            <select className="input" value={sra.functionalArea ?? ""}
              onChange={(e) => set({ functionalArea: e.target.value, subFunction: "" })}>
              <option value="">Select</option>
              {Object.keys(FUNCTIONAL_AREAS).map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label block mb-1.5">Sub-function</span>
            <select className="input" value={sra.subFunction ?? ""} disabled={!subFunctions.length}
              onChange={(e) => set({ subFunction: e.target.value })}>
              <option value="">{subFunctions.length ? "Select" : "Choose a functional area first"}</option>
              {subFunctions.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Hazards: BRD 7 fields 8 to 13 and 15 */}
      {hazards.map((h, i) => (
        <div key={i} className="card p-5 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Hazard {i + 1} {h.id && <span className="id text-slate1 ml-2">{h.id}</span>}</h3>
            <button type="button" className="text-[0.8125rem] text-risk-red" onClick={() => removeHazard(i)}>Remove</button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <Combo
              label="Hazard identified"
              value={h.hazard}
              list={HAZARD_REGISTER}
              placeholder="Choose from the register or add a new hazard"
              onChange={(v) => patchHazard(i, { hazard: v })}
            />
            <label className="block">
              <span className="label block mb-1.5">Resultant risk of the hazard</span>
              <textarea className="input" rows={2} value={h.resultantRisk ?? ""} onChange={(e) => patchHazard(i, { resultantRisk: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label block mb-1.5">Hazard description</span>
              <textarea className="input" rows={3} value={h.description ?? ""} onChange={(e) => patchHazard(i, { description: e.target.value })} />
              <span className="block text-[0.75rem] text-slate1 mt-1">Starts from the reporter&apos;s own description. Edit it to describe the hazard.</span>
            </label>
            <label className="block">
              <span className="label block mb-1.5">Root cause</span>
              <textarea className="input" rows={2} value={h.rootCause ?? ""} onChange={(e) => patchHazard(i, { rootCause: e.target.value })} />
            </label>
            <label className="block">
              <span className="label block mb-1.5">Worst credible effect</span>
              <textarea className="input" rows={2} value={h.worstCredibleEffect ?? ""} onChange={(e) => patchHazard(i, { worstCredibleEffect: e.target.value })} />
            </label>
          </div>

          <ControlRows
            kind="existing"
            title="Existing controls"
            note="What already protects against this hazard today."
            controls={h.controls ?? []}
            onChange={(controls) => patchHazard(i, { controls })}
          />
          <ControlRows
            kind="additional"
            title="Additional risk controls (risk mitigation strategy)"
            note="What you are adding to bring the risk down. These drive the post-mitigation rating."
            controls={h.controls ?? []}
            onChange={(controls) => patchHazard(i, { controls })}
          />
        </div>
      ))}

      <button type="button" className="btn-ghost mt-4" onClick={addHazard}>Add a hazard</button>

      {/* One risk index for the assessment: BRD 7 fields 14 and 16 */}
      <div className="card p-5 mt-4">
        <h3 className="font-semibold">Risk index</h3>
        <p className="text-[0.8125rem] text-slate1 mt-0.5">
          One rating before mitigation and one after, for this assessment as a whole - however many hazards it holds.
          A second finding that needs assessing gets its own SRA tab, and its own pair of ratings.
        </p>
        <div className="mt-5 grid lg:grid-cols-2 gap-6">
          <RiskMatrix label="Outcome pre-mitigation" value={sra.preMitigation} onChange={(v) => set({ preMitigation: v, severityOverrideAccepted: false })} />
          <RiskMatrix label="Outcome post-mitigation" value={sra.postMitigation} onChange={(v) => set({ postMitigation: v, severityOverrideAccepted: false })} />
        </div>
      </div>

      {/* The action that follows: BRD 7 fields 17 to 24 */}
      <div className="card p-5 mt-4">
        <h3 className="font-semibold">Action</h3>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <label className="block sm:col-span-2">
            <span className="label block mb-1.5">Action</span>
            <textarea className="input" rows={3} placeholder="What is to be done about this risk"
              value={sra.action ?? ""} onChange={(e) => set({ action: e.target.value })} />
          </label>
          <div>
            <span className="label block mb-1.5">Owner</span>
            {directory.length ? (
              <PersonPicker
                id="sra-owner"
                people={directory}
                value={sra.owner ?? ""}
                myEmail={me.email}
                onChange={(email) => set({ owner: email, ownerName: directory.find((p) => p.email === email)?.name })}
              />
            ) : (
              <input className="input" placeholder="name@company.com" value={sra.owner ?? ""} onChange={(e) => set({ owner: e.target.value })} />
            )}
            <span className="block text-[0.75rem] text-slate1 mt-1">The department head or employee who carries the action.</span>
          </div>
          <label className="block">
            <span className="label block mb-1.5">Department</span>
            <select className="input" value={sra.department ?? ""} onChange={(e) => set({ department: e.target.value })}>
              <option value="">Select</option>
              {masters.departments.map((d) => <option key={d}>{d}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label block mb-1.5">Sub-department</span>
            <input className="input" value={sra.subDepartment ?? ""} onChange={(e) => set({ subDepartment: e.target.value })} />
          </label>
          <label className="block">
            <span className="label block mb-1.5">Deadline</span>
            <input type="date" className="input" value={sra.deadline ?? ""} onChange={(e) => set({ deadline: e.target.value })} />
          </label>
          <label className="block">
            <span className="label block mb-1.5">Status</span>
            <select className="input" value={sra.status ?? "Open"} onChange={(e) => set({ status: e.target.value as Sra["status"] })}>
              {SRA_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        {sra.status === "Closed" && (
          <div className="mt-4 border-t border-line pt-4 grid sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="label block mb-1.5">Review period</span>
              <select className="input" value={sra.reviewPeriod ?? ""} onChange={(e) => set({ reviewPeriod: e.target.value })}>
                <option value="">Select</option>
                {SRA_REVIEW_PERIODS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </label>
            <div className="block">
              <span className="label block mb-1.5">Review date</span>
              <p className="input bg-surface text-slate1">{reviewDate ?? "Set by the review period"}</p>
              <span className="block text-[0.75rem] text-slate1 mt-1">The last business day of the period you chose.</span>
            </div>
            <label className="block sm:col-span-2">
              <span className="label block mb-1.5">Effectiveness</span>
              <textarea className="input" rows={2} value={sra.effectiveness ?? ""} onChange={(e) => set({ effectiveness: e.target.value })} />
            </label>
            <label className="block sm:col-span-2">
              <span className="label block mb-1.5">Action plan</span>
              <textarea className="input" rows={2} value={sra.actionPlan ?? ""} onChange={(e) => set({ actionPlan: e.target.value })} />
            </label>
          </div>
        )}
      </div>

      {confirmNeeded && (
        <div className="mt-4 rounded-xl border border-risk-yellow/50 bg-risk-yellow/10 p-4">
          <p className="text-sm">
            You are lowering the severity of this risk. Controls usually reduce how likely something is, not how bad it
            would be. Confirm only if the worst credible outcome itself has changed.
          </p>
          <div className="mt-3 flex gap-3">
            <button type="button" className="btn-primary" onClick={() => save(true)}>Confirm and save</button>
            <button type="button" className="btn-ghost" onClick={() => setConfirmNeeded(false)}>Go back</button>
          </div>
        </div>
      )}

      {problems.length > 0 && (
        <div className="mt-4 rounded-xl border border-line bg-surface p-4">
          <p className="text-sm font-medium">Saved. Still needed before this report can be closed:</p>
          <ul className="mt-2 space-y-1 text-[0.8125rem] text-slate1">
            {problems.map((p) => <li key={p}>· {p}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canEdit ? (
          <button type="button" className="btn-primary" disabled={busy} onClick={() => save()}>
            {busy ? "Saving" : "Save assessment"}
          </button>
        ) : (
          <span className="text-[0.8125rem] text-slate1">Read-only: this report is assigned to someone else.</span>
        )}
        <span className="text-[0.8125rem] text-slate1 flex items-center gap-2">
          Pre <RiskChip index={sra.preMitigation} /> → post <RiskChip index={sra.postMitigation} />
        </span>
      </div>

      </fieldset>

      {pendingOnMe && (
        <div className="card p-5 mt-5 border-risk-orange/40">
          <h3 className="font-semibold">Risk acceptance</h3>
          <p className="text-[0.8125rem] text-slate1 mt-1">
            This residual risk sits above the investigator&apos;s tolerance, so it came to you.
          </p>
          <textarea className="input mt-3" rows={2} placeholder="Comment" value={comment} onChange={(e) => setComment(e.target.value)} />
          <div className="mt-3 flex gap-3">
            <button type="button" className="btn-primary" onClick={() => onDecide(sra.id, "approve", comment)}>Accept this risk</button>
            <button type="button" className="btn-danger" onClick={() => onDecide(sra.id, "reject", comment)}>Send back for stronger controls</button>
          </div>
        </div>
      )}
    </div>
  );
}

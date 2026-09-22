"use client";
import { useEffect, useState } from "react";
import type { StageTemplate, WorkflowTemplates } from "@/lib/types";
import StageListEditor, { type EditableStage } from "@/components/stage-list-editor";

interface FormRow {
  formId: string;
  code: string;
  title: string;
  retired: boolean;
}

const FIRST = "report-review";
const LAST = "closure";

function toEditable(stages: StageTemplate[]): EditableStage[] {
  return stages.map((s) => ({
    id: s.key,
    key: s.key,
    name: s.name,
    taskDays: s.taskDays,
    pinned: s.key === FIRST ? "Always first: triage completes it" : s.key === LAST ? "Always last: closure approval completes it" : undefined
  }));
}

const same = (a: EditableStage[] | null, b: EditableStage[] | null) =>
  JSON.stringify(a?.map(({ key, name, taskDays }) => [key, name, taskDays])) ===
  JSON.stringify(b?.map(({ key, name, taskDays }) => [key, name, taskDays]));

/** Administration → Workflows (US-18). */
export default function WorkflowManager({ initial, forms }: { initial: WorkflowTemplates; forms: FormRow[] }) {
  const [templates, setTemplates] = useState(initial);
  const [target, setTarget] = useState("default");
  const saved = target === "default" ? templates.default : templates.byFormId[target] ?? null;
  const [draft, setDraft] = useState<EditableStage[] | null>(saved ? toEditable(saved) : null);
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dirty = !same(draft, saved ? toEditable(saved) : null);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function select(next: string) {
    if (next === target) return;
    if (dirty && !window.confirm("Discard the changes you have not saved?")) return;
    const stages = next === "default" ? templates.default : templates.byFormId[next] ?? null;
    setTarget(next);
    setDraft(stages ? toEditable(stages) : null);
    setErrors([]);
    setNotice(null);
  }

  async function save(stages: EditableStage[] | null) {
    setBusy(true);
    setErrors([]);
    setNotice(null);
    const res = await fetch("/api/admin/workflows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target, stages: stages?.map(({ key, name, taskDays }) => ({ key, name, taskDays })) ?? null })
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErrors(body.errors ?? [body.error ?? "The workflow was not saved."]);
      return;
    }
    const next = body as WorkflowTemplates;
    setTemplates(next);
    const now = target === "default" ? next.default : next.byFormId[target] ?? null;
    setDraft(now ? toEditable(now) : null);
    setNotice(stages ? "Saved. Reports filed from now on use this workflow." : "This report type now uses the default workflow.");
  }

  const name = target === "default" ? "Default workflow" : forms.find((f) => f.formId === target)?.title ?? target;

  return (
    <div className="grid lg:grid-cols-[18rem_minmax(0,1fr)] gap-5">
      <nav aria-label="Workflows" className="card p-2 h-fit">
        <button
          type="button"
          onClick={() => select("default")}
          className={`w-full text-left rounded-xl px-3 py-2 ${target === "default" ? "bg-chartsoft text-chart" : "hover:bg-surface"}`}
        >
          <span className="block text-sm font-medium">Default workflow</span>
          <span className="block text-[0.75rem] text-slate1">Used by every type without its own</span>
        </button>
        <p className="label px-3 pt-3 pb-1">Report types</p>
        {forms.map((f) => {
          const own = Boolean(templates.byFormId[f.formId]);
          return (
            <button
              key={f.formId}
              type="button"
              onClick={() => select(f.formId)}
              className={`w-full text-left rounded-xl px-3 py-2 ${target === f.formId ? "bg-chartsoft text-chart" : "hover:bg-surface"}`}
            >
              <span className="block text-sm">{f.title}</span>
              <span className="block text-[0.75rem] text-slate1">
                <span className="id">{f.code}</span> · {own ? "Own workflow" : "Uses default"}
                {f.retired && " · retired"}
              </span>
            </button>
          );
        })}
      </nav>

      <section className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{name}</h2>
            <p className="text-[0.8125rem] text-slate1 mt-0.5">
              Changes apply to reports filed after you save. Reports already filed keep their stages.
            </p>
          </div>
          {draft && (
            <div className="flex gap-2">
              {target !== "default" && saved && (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => window.confirm(`Send ${name} back to the default workflow?`) && save(null)}
                >
                  Use the default instead
                </button>
              )}
              <button type="button" className="btn-ghost" disabled={busy || !dirty} onClick={() => setDraft(saved ? toEditable(saved) : null)}>
                Discard changes
              </button>
              <button type="button" className="btn-primary" disabled={busy || !dirty} onClick={() => save(draft)}>
                {busy ? "Saving" : "Save workflow"}
              </button>
            </div>
          )}
        </div>

        {errors.length > 0 && (
          <ul className="mt-4 rounded-xl border border-risk-red/30 bg-risk-red/5 p-3 text-sm text-risk-red space-y-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        {notice && <p className="mt-4 rounded-xl border border-risk-green/30 bg-risk-green/10 p-3 text-sm">{notice}</p>}

        <div className="mt-4">
          {draft ? (
            <StageListEditor stages={draft} onChange={setDraft} disabled={busy} />
          ) : (
            <div className="card p-5">
              <p className="text-sm">This report type uses the default workflow:</p>
              <ol className="mt-3 space-y-1 text-sm text-slate1 list-decimal pl-5">
                {templates.default.map((s) => (
                  <li key={s.key}>{s.name} · {s.taskDays} day{s.taskDays === 1 ? "" : "s"}</li>
                ))}
              </ol>
              <button type="button" className="btn-primary mt-4" onClick={() => setDraft(toEditable(templates.default))}>
                Give this report type its own workflow
              </button>
              <p className="text-[0.8125rem] text-slate1 mt-2">Starts as a copy of the default. Nothing changes until you save.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

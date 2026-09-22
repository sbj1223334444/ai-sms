"use client";
import { useState } from "react";
import type { Assignee, Report, Task, TaskType } from "@/lib/types";
import { TASK_TYPES, TASK_STATUS_LABEL, isTaskEditable, isTaskOpen, taskType, taskTypeLabel } from "@/lib/tasks";
import PersonPicker from "@/components/person-picker";
import type { EditableSection } from "@/lib/report-edit";

async function post(url: string, body: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true } : { ok: false, error: data.error ?? "That did not work." };
}

/* ---------------- Raise a task (BRD 3.4, US-08 criteria 1 to 5) ---------------- */

interface NewTaskProps {
  report: Report;
  directory: Assignee[];
  sections: EditableSection[];
  myEmail: string;
  initialType: TaskType;
  initialStage: string;
  onDone: (created: boolean) => void;
}

export function NewTaskForm({ report, directory, sections, myEmail, initialType, initialStage, onDone }: NewTaskProps) {
  const reporterReachable = !report.confidential && Boolean(report.submittedBy);
  const openStages = report.workflow.filter((s) => s.status !== "complete");
  const controls = report.sras.flatMap((s) => s.hazards.flatMap((h) => h.controls.map((c) => ({ id: c.id, text: c.text, sra: s.title }))));
  const today = new Date().toISOString().slice(0, 10);

  const [type, setType] = useState<TaskType>(initialType === "reporter_info" && !reporterReachable ? "company_info" : initialType);
  const kind = taskType(type)!;
  const [stageKey, setStageKey] = useState(openStages.some((s) => s.key === initialStage) ? initialStage : openStages[0]?.key ?? "");
  const [assignee, setAssignee] = useState("");
  const [title, setTitle] = useState(kind.defaultTitle);
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [dueDate, setDueDate] = useState("");
  const [editAccess, setEditAccess] = useState(kind.formEdit === "default");
  const [chosen, setChosen] = useState<string[]>([]);
  const [controlId, setControlId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function pickType(next: TaskType) {
    const def = taskType(next)!;
    setType(next);
    setEditAccess(def.formEdit === "default");
    if (!titleTouched) setTitle(def.defaultTitle);
    setError(null);
  }

  async function create() {
    setBusy(true);
    setError(null);
    const res = await post("/api/tasks", {
      reportId: report.id,
      type,
      stageKey,
      assignee: kind.assignee === "reporter" ? report.submittedBy?.email : assignee,
      title,
      description,
      priority,
      dueDate,
      formEditAccess: kind.formEdit !== "none" && editAccess,
      editableSections: chosen,
      controlId: controlId || undefined
    });
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "The task was not created.");
    onDone(true);
  }

  return (
    <div className="card p-5 border-chart">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">New task</h3>
          <p className="text-[0.8125rem] text-slate1 mt-0.5">
            The assignee is emailed with the report type only, never the report ID. They see the report only if you give edit access below.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => onDone(false)}>Cancel</button>
      </div>

      <fieldset className="mt-4">
        <legend className="label mb-2">What is it for?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {TASK_TYPES.map((t) => {
            const disabled = t.assignee === "reporter" && !reporterReachable;
            return (
              <label
                key={t.type}
                className={`rounded-xl border p-3 text-sm ${type === t.type ? "border-chart bg-chartsoft" : "border-line"} ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <span className="flex items-start gap-2">
                  <input type="radio" name="task-type" className="accent-chart mt-1" checked={type === t.type} disabled={disabled} onChange={() => pickType(t.type)} />
                  <span>
                    <span className="block font-medium">{t.label}</span>
                    <span className="block text-[0.8125rem] text-slate1 mt-0.5">
                      {disabled ? "Not available: this report was filed confidentially, so the reporter cannot be contacted." : t.description}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="task-assignee" className="label block mb-1.5">Assign to</label>
          {kind.assignee === "reporter" ? (
            <p className="input bg-surface">
              {report.submittedBy?.name} <span className="text-slate1">(the reporter)</span>
            </p>
          ) : (
            <PersonPicker id="task-assignee" people={directory} value={assignee} myEmail={myEmail} onChange={setAssignee} />
          )}
        </div>
        <label className="block">
          <span className="label block mb-1.5">Workflow stage</span>
          <select className="input" value={stageKey} onChange={(e) => setStageKey(e.target.value)}>
            {openStages.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
          </select>
          <span className="block text-[0.75rem] text-slate1 mt-1">The stage cannot be completed until this task is accepted.</span>
        </label>
        <label className="block md:col-span-2">
          <span className="label block mb-1.5">Title</span>
          <input className="input" value={title} maxLength={120} onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }} />
        </label>
        <label className="block md:col-span-2">
          <span className="label block mb-1.5">Description and instructions</span>
          <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What do you need from them, and by when?" />
        </label>
        <label className="block">
          <span className="label block mb-1.5">Priority</span>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </label>
        <label className="block">
          <span className="label block mb-1.5">Due date</span>
          <input type="date" className="input" min={today} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          <span className="block text-[0.75rem] text-slate1 mt-1">Chosen by you. There is no automatic deadline.</span>
        </label>

        {kind.control && controls.length > 0 && (
          <label className="block md:col-span-2">
            <span className="label block mb-1.5">Control this task implements (optional)</span>
            <select className="input" value={controlId} onChange={(e) => setControlId(e.target.value)}>
              <option value="">Not linked to a control</option>
              {controls.map((c) => <option key={c.id} value={c.id}>{c.id} · {c.text.slice(0, 80)} ({c.sra.slice(0, 30)})</option>)}
            </select>
          </label>
        )}

        {kind.formEdit !== "none" && (
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-chart" checked={editAccess} onChange={(e) => setEditAccess(e.target.checked)} />
              Let them edit part of the report
            </label>
            {editAccess && (
              <div className="mt-2 rounded-xl border border-line p-3">
                <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                  <p className="label">Which sections may they edit?</p>
                  {sections.length > 0 && (
                    <button
                      type="button"
                      className="text-[0.8125rem] font-medium text-chart"
                      onClick={() => setChosen(chosen.length === sections.length ? [] : sections.map((s) => s.key))}
                    >
                      {chosen.length === sections.length ? "Clear all" : "Select all"}
                    </button>
                  )}
                </div>
                <p className="text-[0.8125rem] text-slate1 mb-2">
                  They open only the sections you tick - the rest of the report, the investigation and the SRA stay
                  hidden. {chosen.length ? `${chosen.length} of ${sections.length} chosen.` : "Nothing chosen yet."}
                </p>
                <div className="grid gap-1.5 sm:grid-cols-2 max-h-56 overflow-auto">
                  {sections.map((s) => (
                    <label key={s.key} className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="accent-chart mt-0.5"
                        checked={chosen.includes(s.key)}
                        onChange={(e) => setChosen(e.target.checked ? [...chosen, s.key] : chosen.filter((k) => k !== s.key))}
                      />
                      <span>
                        {s.label}
                        <span className="block text-[0.75rem] text-slate1">
                          {s.fields.length} question{s.fields.length === 1 ? "" : "s"}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
                {sections.length === 0 && (
                  <p className="text-[0.8125rem] text-slate1">This form has no sections to share. Ask in the description instead.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {error && <p className="mt-4 rounded-xl border border-risk-red/30 bg-risk-red/5 p-3 text-sm text-risk-red" role="alert">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="btn-ghost" onClick={() => onDone(false)}>Cancel</button>
        <button type="button" className="btn-primary" disabled={busy} onClick={create}>{busy ? "Creating" : "Create task"}</button>
      </div>
    </div>
  );
}

/* ---------------- A task as the investigator sees it (US-08 criteria 14 to 16) ---------------- */

interface TaskItemProps {
  task: Task;
  /** Whoever raised the task, or holds the report: they review, change and delete it. */
  canManage: boolean;
  directory: Assignee[];
  myEmail: string;
  /** Tighter presentation for the workflow stage cards. */
  compact?: boolean;
  onChanged: () => void;
}

export function TaskItem({ task, canManage, directory, myEmail, compact, onChanged }: TaskItemProps) {
  const [comment, setComment] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState({ title: task.title, assignee: task.assignee, dueDate: task.dueDate, priority: task.priority as string });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const open = isTaskOpen(task.status);
  const overdue = open && task.dueDate < today;
  const reviewing = task.status === "submitted";
  const editable = isTaskEditable(task.status);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const res = await post(`/api/tasks/${task.id}`, body);
    setBusy(false);
    if (!res.ok) return setError(res.error ?? "That did not work.");
    setComment("");
    setCommenting(false);
    setEditing(false);
    onChanged();
  }

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason })
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return setError(data.error ?? "The task was not deleted.");
    }
    setDeleting(false);
    onChanged();
  }

  return (
    <div className={compact ? "rounded-xl border border-line bg-surface/60 p-3 text-sm" : "border-t border-line pt-3 text-sm"}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{task.title}</p>
        <span className={`text-[0.75rem] whitespace-nowrap ${reviewing ? "text-chart font-medium" : open ? "text-risk-orange" : "text-risk-green"}`}>
          {TASK_STATUS_LABEL[task.status] ?? task.status}
        </span>
      </div>
      <p className="text-slate1 text-[0.8125rem]">
        {taskTypeLabel(task.type)} · {task.assigneeName ?? task.assignee}
      </p>
      <p className="text-slate1 text-[0.8125rem]">
        <span className="id">{task.id}</span> · {task.priority} · <span className={overdue ? "text-risk-red font-medium" : ""}>due {task.dueDate}</span>
        {task.formEditAccess && ` · edits ${task.editableSections.length} section${task.editableSections.length === 1 ? "" : "s"}`}
        {task.controlId && ` · control ${task.controlId}`}
      </p>
      {task.extensionRequested && open && (
        <p className="text-[0.8125rem] mt-1">Asked for more time, until {task.extensionRequested}.</p>
      )}
      {task.response && <p className="mt-2 rounded bg-surface p-2">{task.response}</p>}
      {(task.comments ?? []).length > 0 && (
        <ul className="mt-2 space-y-1">
          {task.comments!.map((c, i) => (
            <li key={i} className="text-[0.8125rem]"><span className="font-medium">{c.by}:</span> {c.text}</li>
          ))}
        </ul>
      )}
      {task.reviewComment && task.status === "rejected" && <p className="text-[0.8125rem] mt-1 text-slate1">Sent back: {task.reviewComment}</p>}

      {canManage && editable && !editing && !deleting && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.8125rem] font-medium">
          {!reviewing && !commenting && (
            <button type="button" className="text-chart" onClick={() => setCommenting(true)}>Comment</button>
          )}
          <button type="button" className="text-chart" onClick={() => { setDraft({ title: task.title, assignee: task.assignee, dueDate: task.dueDate, priority: task.priority }); setEditing(true); }}>
            Change
          </button>
          <button type="button" className="text-risk-red" onClick={() => { setReason(""); setDeleting(true); }}>Delete</button>
        </div>
      )}

      {editing && (
        <div className="mt-2 rounded-xl border border-chart/30 bg-chartsoft/40 p-3">
          <label className="block">
            <span className="label mb-1.5 block">Title</span>
            <input className="input" value={draft.title} maxLength={120} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </label>
          <div className="mt-2">
            <label htmlFor={`reassign-${task.id}`} className="label mb-1.5 block">Assigned to</label>
            <PersonPicker
              id={`reassign-${task.id}`}
              people={directory}
              value={draft.assignee}
              myEmail={myEmail}
              onChange={(email) => setDraft({ ...draft, assignee: email })}
            />
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="label mb-1.5 block">Due date</span>
              <input type="date" className="input" min={today} value={draft.dueDate} onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })} />
            </label>
            <label className="block">
              <span className="label mb-1.5 block">Priority</span>
              <select className="input" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value })}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
          </div>
          {task.extensionRequested && (
            <button
              type="button"
              className="mt-2 text-[0.8125rem] font-medium text-chart"
              onClick={() => setDraft({ ...draft, dueDate: task.extensionRequested! })}
            >
              Grant the extension to {task.extensionRequested}
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => act({ action: "edit", ...draft })}>
              {busy ? "Saving" : "Save task"}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      )}

      {deleting && (
        <div className="mt-2 rounded-xl border border-risk-red/30 bg-red-50 p-3">
          <p className="text-[0.8125rem]">
            Delete this task? It leaves the report and stops holding up its stage. {task.assigneeName ?? task.assignee} is told,
            and the Timeline keeps a record.
          </p>
          <input className="input mt-2" placeholder="Why (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-danger" disabled={busy} onClick={remove}>{busy ? "Deleting" : "Delete task"}</button>
            <button type="button" className="btn-ghost" onClick={() => setDeleting(false)}>Keep it</button>
          </div>
        </div>
      )}

      {canManage && open && (reviewing || commenting) && !editing && !deleting && (
        <div className="mt-2">
          <textarea
            className="input"
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={reviewing ? "Comment (required to send it back)" : "Ask a question or add a comment"}
            autoFocus={commenting}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {reviewing && (
              <>
                <button type="button" className="btn-primary" disabled={busy} onClick={() => act({ action: "review", decision: "accept", comment })}>Accept</button>
                <button type="button" className="btn-ghost" disabled={busy} onClick={() => act({ action: "review", decision: "revise", comment })}>Send back</button>
              </>
            )}
            <button type="button" className="btn-ghost" disabled={busy || !comment.trim()} onClick={() => act({ action: "comment", text: comment })}>Comment</button>
            {commenting && <button type="button" className="btn-ghost" onClick={() => { setCommenting(false); setComment(""); }}>Cancel</button>}
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-[0.8125rem] text-risk-red" role="alert">{error}</p>}
    </div>
  );
}

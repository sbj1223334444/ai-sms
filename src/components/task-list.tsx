"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Assignee, Task } from "@/lib/types";
import SmsForm from "@/components/sms-form";
import { TASK_STATUS_LABEL, isTaskOpen, taskTypeLabel } from "@/lib/tasks";
import { TaskItem } from "@/components/task-workspace";
import { withClears } from "@/lib/report-edit";

type Json = Record<string, unknown>;

/** The report sections a task grants, and their current answers. Nothing else of the report. */
export interface SectionExtract {
  schema: Json;
  uiSchema: Json;
  data: Json;
}

async function post(id: string, body: Json): Promise<string | null> {
  const res = await fetch(`/api/tasks/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data.error ?? "That did not work.";
}

/** One task on My tasks, as the assignee works it (BRD 3.4 Assignee Task Management, US-08 criterion 13). */
function AssignedTask({ task, extract }: { task: Task; extract?: SectionExtract }) {
  const router = useRouter();
  const [response, setResponse] = useState(task.response ?? "");
  const [comment, setComment] = useState("");
  const [until, setUntil] = useState("");
  const [answers, setAnswers] = useState<Json>(extract?.data ?? {});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const open = isTaskOpen(task.status) && task.status !== "submitted";

  async function act(body: Json, done: string) {
    setBusy(true);
    setError(null);
    setNotice(null);
    const err = await post(task.id, body);
    setBusy(false);
    if (err) return setError(err);
    setNotice(done);
    setComment("");
    router.refresh();
  }

  return (
    <li className="card p-4" id={task.id}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{task.title}</p>
          {/* The report type is shown, never the report ID. */}
          <p className="text-[0.8125rem] text-slate1 mt-0.5">
            {taskTypeLabel(task.type)} · {task.reportType} · <span className="id">{task.id}</span> · {task.priority} priority
          </p>
          <p className="text-[0.8125rem] text-slate1">
            Assigned by {task.createdByName ?? task.createdBy} · <a className="text-chart" href={`mailto:${task.createdBy}`}>{task.createdBy}</a>
          </p>
        </div>
        <div className="text-right">
          <p className={`text-[0.8125rem] ${task.dueDate < today && isTaskOpen(task.status) ? "text-risk-red font-medium" : "text-slate1"}`}>Due {task.dueDate}</p>
          <p className="text-[0.8125rem] text-slate1">{TASK_STATUS_LABEL[task.status] ?? task.status}</p>
        </div>
      </div>
      <p className="text-sm mt-3 whitespace-pre-line">{task.description}</p>
      {task.status === "rejected" && task.reviewComment && (
        <p className="mt-3 rounded-xl border border-risk-yellow/40 bg-risk-yellow/10 p-2 text-sm">Sent back: {task.reviewComment}</p>
      )}

      {extract && open && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="label">Report sections you can edit</p>
          <p className="text-[0.8125rem] text-slate1 mt-0.5 mb-3">Only these parts of the report are shown to you. Your changes are recorded against this task.</p>
          <SmsForm
            schema={extract.schema}
            uiSchema={extract.uiSchema}
            formData={answers}
            onChange={setAnswers}
            onSubmit={(data) => act({ action: "editReport", data: withClears(extract.data, data) }, "Saved to the report.")}
          >
            <button type="submit" className="btn-ghost mt-4" disabled={busy}>Save to the report</button>
          </SmsForm>
        </div>
      )}
      {!task.formEditAccess && (
        <p className="text-[0.8125rem] text-slate1 mt-2">You have not been given access to the report itself for this task.</p>
      )}

      {(task.comments ?? []).length > 0 && (
        <ul className="mt-4 border-t border-line pt-3 space-y-1">
          {task.comments!.map((c, i) => (
            <li key={i} className="text-sm"><span className="font-medium">{c.by}:</span> {c.text}</li>
          ))}
        </ul>
      )}

      {open ? (
        <div className="mt-4 border-t border-line pt-3 space-y-3">
          <label className="block">
            <span className="label block mb-1.5">Your response</span>
            <textarea className="input" rows={3} value={response} onChange={(e) => setResponse(e.target.value)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" disabled={busy} onClick={() => act({ action: "complete", response }, "Marked complete. The investigator has been told.")}>Mark complete</button>
            <button className="btn-ghost" disabled={busy} onClick={() => act({ action: "saveProgress", response }, "Progress saved.")}>Save progress</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block flex-1 min-w-[14rem]">
              <span className="label block mb-1.5">Ask a question or comment</span>
              <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
            <button className="btn-ghost" disabled={busy || !comment.trim()} onClick={() => act({ action: "comment", text: comment }, "Sent.")}>Send</button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="label block mb-1.5">Need more time? Until</span>
              <input type="date" className="input" min={task.dueDate} value={until} onChange={(e) => setUntil(e.target.value)} />
            </label>
            <button className="btn-ghost" disabled={busy || !until} onClick={() => act({ action: "requestExtension", until }, "Extension requested.")}>Request extension</button>
            {task.extensionRequested && <span className="text-[0.8125rem] text-slate1">Requested until {task.extensionRequested}.</span>}
          </div>
        </div>
      ) : (
        <p className="mt-4 border-t border-line pt-3 text-sm text-slate1">
          {task.status === "submitted" ? "Waiting for the investigator to review your response." : "Accepted. Nothing more to do."}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-risk-red" role="alert">{error}</p>}
      {notice && <p className="mt-3 text-sm text-risk-green">{notice}</p>}
    </li>
  );
}

export default function TaskList({
  mine, raised, extracts, directory, myEmail
}: {
  mine: Task[];
  raised: Task[];
  extracts: Record<string, SectionExtract>;
  directory: Assignee[];
  myEmail: string;
}) {
  const router = useRouter();
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <section>
        <h2 className="font-semibold mb-3">Assigned to me</h2>
        <ul className="space-y-3">
          {mine.map((t) => <AssignedTask key={t.id} task={t} extract={extracts[t.id]} />)}
          {mine.length === 0 && <li className="text-sm text-slate1">Nothing assigned to you.</li>}
        </ul>
      </section>

      <section>
        <h2 className="font-semibold mb-3">Raised by me</h2>
        <ul className="card p-4 space-y-3">
          {raised.map((t) => (
            <li key={t.id}>
              <TaskItem task={t} canManage directory={directory} myEmail={myEmail} onChanged={() => router.refresh()} />
            </li>
          ))}
          {raised.length === 0 && <li className="text-sm text-slate1">You have not raised any tasks.</li>}
        </ul>
      </section>
    </div>
  );
}

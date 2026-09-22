"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormDef } from "@/lib/types";
import SmsForm from "@/components/sms-form";
import { ArrowLeft, Check, Paperclip, Upload } from "@/components/icons";

interface Props {
  def: FormDef;
  reporter: { name: string; email: string; staffNo: string; department: string };
}

const MB = 1024 * 1024;
const size = (n: number) => (n >= MB ? `${(n / MB).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function FormRenderer({ def, reporter }: Props) {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown>>({});
  const [attachments, setAttachments] = useState<{ name: string; size: number }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const confidential = def.meta.supportsConfidential && data.confidential === "Yes";

  async function submit(formData: Record<string, unknown>) {
    setBusy(true);
    setErrors([]);
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ formId: def.meta.formId, data: formData, attachments })
    });
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setErrors(body.errors ?? [body.error ?? "Submission failed."]);
      return;
    }
    setDone(body.id);
    window.scrollTo({ top: 0 });
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map((f) => ({ name: f.name, size: f.size }));
    const tooBig = next.filter((f) => f.size > 25 * MB);
    if (tooBig.length) return setErrors([`${tooBig[0].name} is over the 25 MB limit for a single file.`]);
    if (attachments.length + next.length > 10) return setErrors(["You can attach up to 10 files to one report."]);
    setErrors([]);
    setAttachments([...attachments, ...next]);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg pt-6">
        <div className="card p-8 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/60">
            <Check className="h-7 w-7" />
          </span>
          <h1 className="mt-5 text-xl font-semibold">Report received</h1>
          <p className="mt-2 text-sm text-slate1">The safety team has it. You will get an email if an investigator needs anything from you.</p>
          <div className="mt-6 rounded-xl bg-surface px-4 py-3">
            <p className="eyebrow">Report ID</p>
            <p className="id mt-1 text-lg font-semibold text-ink">{done}</p>
          </div>
          {confidential && (
            <p className="mt-4 text-[0.8125rem] text-slate1">You filed this confidentially, so your name and staff number were never stored with the report.</p>
          )}
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button className="btn-primary" onClick={() => router.push("/my-submissions")}>View my submissions</button>
            <button className="btn-ghost" onClick={() => router.push("/report/new")}>File another report</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Link href="/report/new" className="mb-4 inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-slate1 hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All forms
      </Link>
      <div className="mb-7">
        <span className="chip id">{def.meta.code}</span>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[1.75rem]">{def.meta.title}</h1>
        <p className="mt-1.5 max-w-3xl text-sm text-slate1">{def.meta.summary}</p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <SmsForm
            id="report-form"
            schema={def.schema}
            uiSchema={def.uiSchema}
            formData={data}
            identity={reporter}
            onChange={setData}
            onSubmit={submit}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-8">
          {confidential && (
            <div className="card p-5">
              <p className="eyebrow">Filed confidentially</p>
              <p className="mt-2 text-sm">
                This report will be stored without your name, staff number, email or department. Nobody who handles it
                can see who filed it.
              </p>
            </div>
          )}

          <div className="card p-5">
            <p className="eyebrow">Attachments{def.meta.attachmentsRequired && <span className="text-risk-red"> *</span>}</p>
            <label className="mt-3 flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-line px-4 py-6 text-center transition hover:border-chart/40 hover:bg-chartsoft/40">
              <Upload className="h-6 w-6 text-chart" />
              <span className="mt-2 text-sm font-medium">Choose files</span>
              <span className="mt-0.5 text-[0.75rem] text-slate1">Word, PDF, JPG, PNG · 25 MB each · up to 10</span>
              <input type="file" multiple className="sr-only" onChange={(e) => addFiles(e.target.files)} />
            </label>
            {def.meta.attachmentsRequired && <p className="mt-2 text-[0.75rem] text-slate1">At least one document is required for this form.</p>}
            {attachments.length > 0 && (
              <ul className="mt-3 space-y-2">
                {attachments.map((a, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm">
                    <Paperclip className="h-4 w-4 shrink-0 text-slate1" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <span className="text-[0.75rem] text-slate1">{size(a.size)}</span>
                    <button type="button" className="text-[0.75rem] font-medium text-risk-red hover:underline" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-5">
            {errors.length > 0 && (
              <div className="mb-4 rounded-xl border border-risk-red/20 bg-red-50 p-3" role="alert">
                <p className="text-sm font-semibold text-risk-red">This report was not submitted</p>
                <ul className="mt-1.5 space-y-1 text-[0.8125rem] text-risk-red">
                  {errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            <button form="report-form" type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? "Submitting" : "Submit report"}
            </button>
            <p className="mt-2.5 text-center text-[0.75rem] text-slate1">You get a report ID as soon as it is filed.</p>
          </div>
        </aside>
      </div>
    </>
  );
}

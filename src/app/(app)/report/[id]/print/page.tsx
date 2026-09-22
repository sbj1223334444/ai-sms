import { notFound } from "next/navigation";
import { normaliseSra } from "@/lib/sra";
import { currentUser } from "@/lib/session";
import { getReport, listTasks } from "@/lib/store";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

/** Report extraction (BRD feature 8): print to PDF from the browser, no headless Chrome needed. */
export default async function PrintReport({ params }: { params: { id: string } }) {
  const user = (await currentUser())!;
  if (!can(user.role, "report.extract")) notFound();
  const loaded = await getReport(params.id);
  if (!loaded) notFound();
  const r = loaded.data;
  const tasks = (await listTasks()).filter((t) => t.reportId === r.id);

  return (
    <div className="bg-white text-ink p-10 max-w-[850px] mx-auto text-sm leading-relaxed">
      <header className="border-b-2 border-chart pb-3 mb-6">
        <p className="text-[0.75rem] text-slate1">Air India · Flight Safety · Safety Management System</p>
        <h1 className="text-xl font-semibold mt-1">{r.formTitle}</h1>
        <p className="id mt-1">{r.safetyRef ?? r.id}</p>
      </header>

      <Section title="1. Report as submitted">
        <Rows data={r.data} />
        <p className="mt-2 text-[0.8125rem] text-slate1">
          Filed {new Date(r.submittedAt).toLocaleString("en-IN")} by {r.confidential ? "a confidential reporter" : r.submittedBy?.name}
        </p>
      </Section>

      {r.cae?.aircraft && (
        <Section title="2. Crew and aircraft">
          <Rows data={r.cae.aircraft as unknown as Record<string, unknown>} />
          {r.cae.crew?.map((c, i) => <p key={i}>{c.name} — {c.role}, {c.licence}, {c.base}</p>)}
        </Section>
      )}

      {r.investigation && (
        <Section title="3. Investigation">
          <p className="font-medium">Synopsis</p><p>{r.investigation.synopsis}</p>
          <p className="font-medium mt-3">Analysis</p><p>{r.investigation.analysis}</p>
          <p className="font-medium mt-3">Findings</p>
          <ol className="list-decimal pl-5">
            {r.investigation.findings.map((f) => (
              <li key={f.id} className="mb-2">
                {f.text}
                {f.rootCause && <div className="text-slate1">Root cause: {f.rootCause}</div>}
                {f.actions && <div className="text-slate1">Actions: {f.actions}</div>}
              </li>
            ))}
          </ol>
          <p className="font-medium mt-3">Safety recommendations</p><p>{r.investigation.recommendations}</p>
        </Section>
      )}

      {r.sras.map((raw, i) => normaliseSra(raw, i)).map((s) => (
        <Section key={s.id} title={`4. Safety risk assessment — ${s.title}`}>
          <p>
            Serial {s.serial} · originator {s.originator ?? "unknown"} · {s.functionalArea ?? "no functional area"}
            {s.subFunction ? ` / ${s.subFunction}` : ""} · location {s.location ?? "not given"}
          </p>
          <p>Pre-mitigation {s.preMitigation ?? "not rated"} → post-mitigation {s.postMitigation ?? "not rated"}</p>
          {s.hazards.map((h) => (
            <div key={h.id} className="mb-3 border-l-2 border-line pl-3">
              <p className="font-medium">{h.hazard} <span className="id text-slate1">{h.id}</span></p>
              {h.rootCause && <p>Root cause: {h.rootCause}</p>}
              {h.worstCredibleEffect && <p>Worst credible effect: {h.worstCredibleEffect}</p>}
              {h.controls.map((c) => (
                <p key={c.id} className="text-slate1">
                  {c.id} {c.text} — {c.kind === "existing" ? "existing control" : "additional control"}, monitored {c.monitoringPeriod ?? "N/A"}
                  {c.reviewOutcome ? `, reviewed ${c.reviewOutcome}` : ""}
                </p>
              ))}
            </div>
          ))}
          <p>
            Action: {s.action ?? "none recorded"} — owner {s.ownerName ?? s.owner ?? "unassigned"}
            {s.department ? `, ${s.department}` : ""}, due {s.deadline ?? "no date"}, {s.status ?? "Open"}
          </p>
          {s.status === "Closed" && (
            <p>Review {s.reviewPeriod ?? "not set"}{s.reviewDate ? ` on ${s.reviewDate}` : ""}. {s.effectiveness ?? ""}</p>
          )}
        </Section>
      ))}

      <Section title="5. Workflow">
        {r.workflow.map((s) => (
          <p key={s.key}>{s.name} — target {s.targetDate}, {s.status.replace("_", " ")}{s.completedAt ? `, completed ${s.completedAt.slice(0, 10)}` : ""}</p>
        ))}
      </Section>

      <Section title="6. Tasks">
        {tasks.length === 0 ? <p>None.</p> : tasks.map((t) => (
          <p key={t.id}><span className="id">{t.id}</span> {t.title} — {t.assignee}, due {t.dueDate}, {t.status}</p>
        ))}
      </Section>

      <Section title="7. Timeline">
        {r.timeline.map((t, i) => (
          <p key={i}>{new Date(t.at).toLocaleString("en-IN")} — {t.actor} — {t.action}{t.detail ? `: ${t.detail}` : ""}</p>
        ))}
      </Section>

      {r.closure && (
        <Section title="8. Closure">
          <p>Submitted by {r.closure.submittedBy} on {r.closure.submittedAt?.slice(0, 10)}</p>
          <p>Sign-off: {r.closure.signOff}</p>
          {r.closure.gatekeeper && <p>Gatekeeper {r.closure.gatekeeper.decision} by {r.closure.gatekeeper.by}</p>}
          {r.closure.cofs && <p>COFS {r.closure.cofs.decision} by {r.closure.cofs.by}</p>}
        </Section>
      )}

      <p className="mt-8 pt-3 border-t border-line text-[0.75rem] text-slate1">
        Extracted {new Date().toLocaleString("en-IN")} by {user.name}. Use your browser to print or save as PDF.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="font-semibold border-b border-line pb-1 mb-2">{title}</h2>
      {children}
    </section>
  );
}

function Rows({ data }: { data: Record<string, unknown> }) {
  return (
    <dl>
      {Object.entries(data).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6 border-b border-line py-1">
          <dt className="text-slate1 capitalize">{k.replace(/([A-Z])/g, " $1").trim()}</dt>
          <dd className="text-right">{Array.isArray(v) ? v.join(", ") : String(v ?? "-")}</dd>
        </div>
      ))}
    </dl>
  );
}

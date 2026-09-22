import Link from "next/link";
import { STATUS_LABEL } from "@/lib/workflow";

const TONE: Record<string, { pill: string; dot: string }> = {
  new: { pill: "bg-chartsoft text-chart ring-chart/15", dot: "bg-chart" },
  in_progress: { pill: "bg-indigo-50 text-indigo-700 ring-indigo-600/15", dot: "bg-indigo-500" },
  pending_risk_approval: { pill: "bg-orange-50 text-orange-700 ring-orange-600/15", dot: "bg-orange-500" },
  pending_gatekeeper_approval: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  pending_cofs_approval: { pill: "bg-amber-50 text-amber-700 ring-amber-600/20", dot: "bg-amber-500" },
  effectiveness_review: { pill: "bg-emerald-50 text-emerald-700 ring-emerald-600/15", dot: "bg-emerald-500" },
  closed: { pill: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400" },
  rejected: { pill: "bg-red-50 text-red-700 ring-red-600/15", dot: "bg-red-500" },
  draft: { pill: "bg-slate-100 text-slate-600 ring-slate-500/15", dot: "bg-slate-400" }
};

export function StatusBadge({ status }: { status: string }) {
  const tone = TONE[status] ?? TONE.in_progress;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.75rem] font-medium ring-1 ring-inset ${tone.pill}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function Empty({ title, action, href, note }: { title: string; action?: string; href?: string; note?: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-chartsoft text-chart">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 13l2.2-7.1A2 2 0 0 1 8.1 4.5h7.8a2 2 0 0 1 1.9 1.4L20 13" />
          <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5h-4.5l-1.5 2.5h-4L8.5 13z" />
        </svg>
      </span>
      <p className="mt-4 text-sm font-semibold text-ink">{title}</p>
      {note && <p className="mt-1 max-w-sm text-[0.8125rem] text-slate1">{note}</p>}
      {action && href && (
        <Link className="btn-primary mt-5" href={href}>
          {action}
        </Link>
      )}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="mb-4 block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint mt-1.5 block">{hint}</span>}
    </label>
  );
}

/** Page title, one line of context, and the page's main actions on the right. */
export function PageHeader({ title, note, eyebrow, actions }: { title: React.ReactNode; note?: React.ReactNode; eyebrow?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[1.75rem]">{title}</h1>
        {note && <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-slate1">{note}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return <PageHeader title={children} note={note} />;
}

/** A number with a label, for the tops of dashboards. */
export function Stat({ label, value, tone = "default", hint }: { label: string; value: number | string; tone?: "default" | "blue" | "amber" | "green" | "red"; hint?: string }) {
  const accent = {
    default: "text-ink",
    blue: "text-chart",
    amber: "text-amber-600",
    green: "text-emerald-600",
    red: "text-risk-red"
  }[tone];
  return (
    <div className="card p-5">
      <p className="text-[0.8125rem] font-medium text-slate1">{label}</p>
      <p className={`mt-2 text-3xl font-semibold tracking-tight ${accent}`}>{value}</p>
      {hint && <p className="mt-1 text-[0.75rem] text-slate1">{hint}</p>}
    </div>
  );
}

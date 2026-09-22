"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { FormMeta } from "@/lib/types";
import { Alert, ChevronRight, FileText, Moon, Plane, Search, Shield, Users, Wrench } from "@/components/icons";

/* Icon and colour per shipped form; anything built in the form editor gets the generic look. */
const LOOK: Record<string, { icon: typeof FileText; tint: string }> = {
  "voluntary-safety-report": { icon: Shield, tint: "bg-chartsoft text-chart" },
  "occurrence-report": { icon: FileText, tint: "bg-indigo-50 text-indigo-600" },
  "bird-strike": { icon: Plane, tint: "bg-sky-50 text-sky-600" },
  "air-traffic-incident": { icon: Plane, tint: "bg-sky-50 text-sky-600" },
  "ra-report": { icon: Plane, tint: "bg-sky-50 text-sky-600" },
  "runway-incursion": { icon: Alert, tint: "bg-orange-50 text-orange-600" },
  "laser-interference": { icon: Alert, tint: "bg-orange-50 text-orange-600" },
  "gps-interference": { icon: Alert, tint: "bg-orange-50 text-orange-600" },
  "ground-incident": { icon: Wrench, tint: "bg-amber-50 text-amber-600" },
  "dg-occurrence": { icon: Alert, tint: "bg-red-50 text-red-600" },
  "fatigue-report": { icon: Moon, tint: "bg-violet-50 text-violet-600" },
  "unruly-passenger": { icon: Users, tint: "bg-rose-50 text-rose-600" },
  "death-on-board": { icon: Users, tint: "bg-slate-100 text-slate-600" }
};

export default function FormPicker({ forms }: { forms: FormMeta[] }) {
  const [q, setQ] = useState("");
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return forms.filter((f) => words.every((w) => `${f.title} ${f.code} ${f.summary}`.toLowerCase().includes(w)));
  }, [forms, q]);

  return (
    <>
      {forms.length > 6 && (
        <div className="relative mb-5 max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate1" />
          <input className="input pl-10" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forms" aria-label="Search forms" />
        </div>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((f) => {
          const look = LOOK[f.formId] ?? { icon: FileText, tint: "bg-chartsoft text-chart" };
          const I = look.icon;
          return (
            <li key={f.formId}>
              <Link
                href={`/report/new/${f.formId}`}
                className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:border-chart/30 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className={`grid h-11 w-11 place-items-center rounded-xl ${look.tint}`}>
                    <I className="h-5 w-5" />
                  </span>
                  <span className="chip id">{f.code}</span>
                </div>
                <p className="mt-4 font-semibold leading-snug text-ink">{f.title}</p>
                <p className="mt-1.5 flex-1 text-[0.8125rem] leading-relaxed text-slate1">{f.summary}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-chart">
                  Start report <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {shown.length === 0 && <p className="text-sm text-slate1">No form matches &ldquo;{q}&rdquo;.</p>}
    </>
  );
}

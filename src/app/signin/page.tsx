"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { DEMO_USERS, DEMO_PASSWORD } from "@/lib/demo-users";
import { roleLabel } from "@/lib/rbac";
import { BrandMark } from "@/components/app-shell";
import { initials } from "@/components/persona-switcher";
import { CheckSquare, ChevronRight, Queue, Shield } from "@/components/icons";

const DEPARTMENTS = ["Flight Operations", "Cabin Crew", "Engineering", "Ground Handling", "Cargo", "AOD", "Security", "Corporate Safety"];
const ROLES = ["reporter", "gatekeeper", "investigator", "cofs", "system_admin"] as const;

const ROLE_TINT: Record<string, string> = {
  reporter: "bg-slate-100 text-slate-600",
  gatekeeper: "bg-amber-50 text-amber-700",
  investigator: "bg-chartsoft text-chart",
  cofs: "bg-rose-50 text-rose-700",
  system_admin: "bg-violet-50 text-violet-700"
};

const POINTS = [
  { icon: Shield, title: "Report in minutes", text: "Thirteen BRD forms, sectioned and validated, with confidential filing." },
  { icon: Queue, title: "Triage and investigate", text: "Gatekeeper queues, five-tab workspace, 5×5 risk matrix." },
  { icon: CheckSquare, title: "Close the loop", text: "Tasks, two-stage approval and effectiveness monitoring." }
];

export default function SignIn() {
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"accounts" | "self">("accounts");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [role, setRole] = useState<string>("reporter");

  return (
    <main className="min-h-dvh bg-surface lg:grid lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
      {/* Brand panel */}
      <section className="relative overflow-hidden bg-navy px-6 py-10 text-white sm:px-10 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-chart/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand/20 blur-3xl" aria-hidden="true" />
        <div className="relative">
          <BrandMark />
          <h1 className="mt-10 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            One record for every safety report, from filing to proven fix.
          </h1>
          <p className="mt-4 max-w-md text-[0.9375rem] leading-relaxed text-white/65">
            An aviation safety management system for flight safety teams. Pick an account to see the system from that person&apos;s seat.
          </p>
        </div>
        <ul className="relative mt-10 space-y-5 lg:mt-0">
          {POINTS.map((p) => (
            <li key={p.title} className="flex gap-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-white">
                <p.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold">{p.title}</span>
                <span className="block text-[0.8125rem] text-white/55">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sign-in */}
      <section className="px-4 py-8 sm:px-8 lg:overflow-y-auto lg:px-12 lg:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
              <p className="mt-1 text-sm text-slate1">Demo build: choose an account, or sign in as yourself.</p>
            </div>
            <div className="inline-flex rounded-xl border border-line bg-white p-1 shadow-xs" role="tablist">
              {(["accounts", "self"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={`rounded-lg px-3.5 py-1.5 text-sm font-medium transition ${tab === t ? "bg-chart text-white shadow-sm" : "text-slate1 hover:text-ink"}`}
                >
                  {t === "accounts" ? "Demo accounts" : "Sign in as yourself"}
                </button>
              ))}
            </div>
          </div>

          {tab === "accounts" ? (
            <>
              <ul className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {DEMO_USERS.map((u) => (
                  <li key={u.id}>
                    <button
                      disabled={busy !== null}
                      onClick={() => { setBusy(u.id); signIn("demo", { userId: u.id, callbackUrl: "/" }); }}
                      className="card group flex h-full w-full flex-col p-4 text-left transition hover:-translate-y-0.5 hover:border-chart/30 hover:shadow-lift disabled:opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-chart to-indigo-400 text-[0.8125rem] font-semibold text-white">
                          {initials(u.name)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-ink">{u.name}</span>
                          <span className="id block text-[0.75rem] text-slate1">{u.id}</span>
                        </span>
                      </div>
                      <span className="mt-3 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold ${ROLE_TINT[u.role] ?? ROLE_TINT.reporter}`}>{roleLabel(u.role)}</span>
                        <span className="rounded-full bg-surface px-2 py-0.5 text-[0.6875rem] font-medium text-slate1">{u.department}</span>
                      </span>
                      <span className="mt-2.5 flex-1 text-[0.8125rem] leading-relaxed text-slate1">{u.blurb}</span>
                      <span className="mt-3 inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-chart">
                        {busy === u.id ? "Signing in" : "Sign in as this person"}
                        <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-[0.8125rem] text-slate1">
                Signing in from another device? Use the user ID on the card with the password <span className="id font-semibold text-ink">{DEMO_PASSWORD}</span>. Once
                you are in, switch between accounts from the menu at the bottom of the sidebar.
              </p>
            </>
          ) : (
            <div className="card mt-7 max-w-md p-6">
              <p className="font-semibold">Use your own name</p>
              <p className="mb-5 mt-1 text-[0.8125rem] text-slate1">
                Anyone can sign in. The department and role you choose decide which forms you see and what you can do.
              </p>
              <label className="mb-4 block">
                <span className="field-label">Your name</span>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </label>
              <label className="mb-4 block">
                <span className="field-label">Department</span>
                <select className="input" value={department} onChange={(e) => setDepartment(e.target.value)}>
                  {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="mb-6 block">
                <span className="field-label">Role</span>
                <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                  {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
                </select>
              </label>
              <button
                className="btn-primary w-full"
                disabled={!name.trim()}
                onClick={() => signIn("guest", { name, department, role, callbackUrl: "/" })}
              >
                Enter the system
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import PersonaSwitcher from "@/components/persona-switcher";
import NotificationBell from "@/components/notification-bell";
import { CheckSquare, Close, Inbox, Menu, PlusCircle, Queue, Settings, Shield } from "@/components/icons";

const ICONS = { report: PlusCircle, submissions: Inbox, queue: Queue, tasks: CheckSquare, admin: Settings } as const;

export interface NavItem {
  href: string;
  label: string;
  icon: keyof typeof ICONS;
  section: "Report" | "Work" | "Manage";
}

interface Props {
  nav: NavItem[];
  user: { name: string; email: string; role: string; department: string };
  demo: boolean;
  /** Running on a serverless host, where an in-memory store is not just temporary but split. */
  hosted?: boolean;
  children: React.ReactNode;
}

export function BrandMark({ light = true }: { light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-chart text-white shadow-sm">
        <Shield className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className={`block text-[0.9375rem] font-semibold tracking-tight ${light ? "text-white" : "text-ink"}`}>AI SMS</span>
        <span className={`block text-[0.6875rem] ${light ? "text-white/55" : "text-slate1"}`}>Safety Management</span>
      </span>
    </span>
  );
}

/** Sidebar on desktop, top bar with a slide-out menu on phones. */
export default function AppShell({ nav, user, demo, hosted, children }: Props) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  const active = (href: string) => (href === "/report/new" ? path.startsWith("/report/new") : path === href || path.startsWith(`${href}/`));
  const sections = ["Report", "Work", "Manage"] as const;

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/" aria-label="AI SMS home"><BrandMark /></Link>
        <div className="flex items-center gap-2">
          <NotificationBell userEmail={user.email} />
          <button type="button" className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white lg:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <Close className="h-5 w-5" />
          </button>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main">
        {sections.map((s) => {
          const items = nav.filter((n) => n.section === s);
          if (!items.length) return null;
          return (
            <div key={s}>
              <p className="px-3 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-white/35">{s}</p>
              <ul className="space-y-0.5">
                {items.map((n) => {
                  const I = ICONS[n.icon];
                  const on = active(n.href);
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        aria-current={on ? "page" : undefined}
                        className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                          on ? "bg-white/10 text-white shadow-[inset_2px_0_0_0_#E30A17]" : "text-white/65 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <I className={`h-[1.15rem] w-[1.15rem] ${on ? "text-white" : "text-white/50 group-hover:text-white/80"}`} />
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      {demo && (
        <div className="mx-3 mb-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-3 py-2.5 text-[0.75rem] leading-relaxed text-amber-100/90">
          {hosted ? (
            <>
              <span className="font-semibold text-amber-200">No datastore connected.</span> Every page and API call on this
              deployment keeps its own copy, so a report, task or stage change can disappear on the next click. Connect a
              Redis store under Storage in the hosting dashboard.
            </>
          ) : (
            <>
              <span className="font-semibold text-amber-200">Demo mode.</span> Data is held in memory and resets when the
              server restarts.
            </>
          )}
        </div>
      )}
      <div className="border-t border-white/10 p-3">
        <PersonaSwitcher current={user} />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {/* Phone and tablet */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-white/10 bg-navy px-4 lg:hidden">
        <Link href="/" aria-label="AI SMS home"><BrandMark /></Link>
        <div className="flex items-center gap-2">
          <NotificationBell userEmail={user.email} />
          <button type="button" className="rounded-lg p-2 text-white/80 hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open}>
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" aria-label="Close menu" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-lift">{sidebar}</div>
        </div>
      )}

      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
    </div>
  );
}

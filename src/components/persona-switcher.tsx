"use client";
import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { DEMO_USERS } from "@/lib/demo-users";
import { roleLabel } from "@/lib/rbac";
import { ChevronUpDown, LogOut } from "@/components/icons";

export function initials(name: string): string {
  return name.replace(/^(Capt\.|Dr\.)\s+/, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

/** Switch account from anywhere without signing out. The session is updated in place. */
export default function PersonaSwitcher({ current }: { current: { name: string; role: string; department: string } }) {
  const [open, setOpen] = useState(false);
  const { update } = useSession();
  const router = useRouter();

  async function switchTo(id: string) {
    setOpen(false);
    const ok = await update({ personaId: id });
    if (!ok) {
      await signIn("demo", { userId: id, callbackUrl: window.location.pathname });
      return;
    }
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/5"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-chart to-indigo-400 text-[0.8125rem] font-semibold text-white">
          {initials(current.name)}
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-sm font-medium text-white">{current.name}</span>
          <span className="block truncate text-[0.75rem] text-white/50">{roleLabel(current.role as never)} · {current.department}</span>
        </span>
        <ChevronUpDown className="h-4 w-4 shrink-0 text-white/40" />
      </button>

      {open && (
        <>
          <button type="button" className="fixed inset-0 z-40 cursor-default" aria-label="Close" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 z-50 mb-2 w-[19rem] max-w-[85vw] overflow-hidden rounded-2xl border border-line bg-white text-ink shadow-lift">
            <p className="border-b border-line px-4 py-3 text-[0.8125rem] text-slate1">Switch account. Your view changes immediately.</p>
            <ul className="max-h-[55vh] overflow-y-auto py-1">
              {DEMO_USERS.map((u) => {
                const active = u.name === current.name;
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      onClick={() => switchTo(u.id)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left transition hover:bg-surface ${active ? "bg-chartsoft" : ""}`}
                    >
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface text-[0.75rem] font-semibold text-slate1">{initials(u.name)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="block truncate text-[0.75rem] text-slate1">{roleLabel(u.role)} · {u.department}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex border-t border-line">
              <a href="/signin" className="flex-1 px-4 py-3 text-[0.8125rem] font-medium text-chart hover:bg-surface">Sign in as someone else</a>
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/signin" })}
                className="flex items-center gap-1.5 border-l border-line px-4 py-3 text-[0.8125rem] font-medium text-slate1 hover:bg-surface hover:text-ink"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

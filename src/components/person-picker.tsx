"use client";
import { Fragment, useEffect, useId, useMemo, useRef, useState } from "react";
import type { Assignee } from "@/lib/types";

const GROUP_LABEL: Record<string, string> = {
  investigator: "Investigators and SMS nodals",
  gatekeeper: "Gatekeepers",
  cofs: "Chief of Flight Safety",
  system_admin: "Administrators",
  admin: "Administrators",
  reporter: "Staff"
};

/** Role and reach in one line, so the person choosing can tell who fits. */
export function describePerson(p: Assignee): string {
  switch (p.role) {
    case "gatekeeper":
      return `Gatekeeper · ${p.department}`;
    case "investigator":
      return p.scope === "all" ? `Investigator · ${p.department} · sees all reports` : `SMS nodal · ${p.department} only`;
    case "cofs":
      return `COFS · ${p.department}`;
    case "system_admin":
    case "admin":
      return `Administrator · ${p.department}`;
    default:
      return p.department;
  }
}

interface Props {
  id: string;
  people: Assignee[];
  value: string;
  myEmail: string;
  onChange: (email: string) => void;
}

/**
 * Searchable list of people, grouped by role. Used to assign an investigator at triage and to
 * assign tasks. Typing filters on name, email, department and role; every word has to match
 * somewhere. Arrow keys move, Enter picks, Escape closes. Only listed people can be picked, and
 * the APIs refuse anyone else.
 */
export default function PersonPicker({ id, people, value, myEmail, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const selected = people.find((p) => p.email === value);

  const matches = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return people.filter((p) => {
      const haystack = `${p.name} ${p.email} ${p.department} ${describePerson(p)}`.toLowerCase();
      return words.every((w) => haystack.includes(w));
    });
  }, [people, query]);

  useEffect(() => setActive(0), [query]);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function pick(p: Assignee) {
    onChange(p.email);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (!matches.length) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => Math.min(Math.max(i + step, 0), matches.length - 1));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      pick(matches[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        name="person-search"
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        className="input pr-9"
        placeholder={selected?.name ?? "Search by name, department or role"}
        value={open ? query : selected?.name ?? ""}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onKeyDown={onKeyDown}
      />
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className={`pointer-events-none absolute right-3 top-[0.8rem] h-4 w-4 text-slate1 transition-transform ${open ? "rotate-180" : ""}`}
      >
        <path d="M5 7.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {selected && !open && (
        <p className="mt-1 text-[0.8125rem] text-slate1">
          {describePerson(selected)} · {selected.email}
        </p>
      )}

      {open && (
        <ul
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-xl border border-line bg-white py-1 shadow-lift"
        >
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate1">Nobody matches &ldquo;{query}&rdquo;.</li>
          )}
          {matches.map((p, i) => (
            <Fragment key={p.email}>
              {(i === 0 || matches[i - 1].role !== p.role) && (
                <li role="presentation" className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-slate1">
                  {GROUP_LABEL[p.role] ?? p.role}
                </li>
              )}
              <li
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={p.email === value}
                className={`cursor-pointer px-3 py-2 ${i === active ? "bg-chartsoft" : ""}`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium text-ink">
                    {p.name}
                    {p.email === myEmail && <span className="font-normal text-slate1"> (you)</span>}
                  </span>
                  {p.email === value && <span className="text-xs font-medium text-chart">Selected</span>}
                </div>
                <div className="text-[0.8125rem] text-slate1">
                  {describePerson(p)} · {p.email}
                </div>
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}

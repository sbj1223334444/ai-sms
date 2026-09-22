"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sub-navigation for Administration. Each tab is shown only to roles that can use it. */
export default function AdminTabs({ forms, workflows, groups }: { forms: boolean; workflows: boolean; groups?: boolean }) {
  const path = usePathname();
  const tabs = [
    { href: "/admin", label: "Overview", show: true, active: path === "/admin" },
    { href: "/admin/forms", label: "Forms", show: forms, active: path.startsWith("/admin/forms") && !path.startsWith("/admin/form-gatekeeper") },
    { href: "/admin/workflows", label: "Workflows", show: workflows, active: path.startsWith("/admin/workflows") },
    { href: "/admin/groups", label: "Groups", show: groups ?? false, active: path.startsWith("/admin/groups") },
    { href: "/admin/form-gatekeeper", label: "Form Assignment", show: forms, active: path.startsWith("/admin/form-gatekeeper") }
  ].filter((t) => t.show);

  return (
    <nav className="mb-7 inline-flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-line bg-white p-1.5 shadow-xs" aria-label="Administration">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition ${t.active ? "bg-chart text-white shadow-sm" : "text-slate1 hover:bg-surface hover:text-ink"}`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

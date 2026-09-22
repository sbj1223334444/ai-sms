import { redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { isDurable } from "@/lib/store";
import AppShell, { type NavItem } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/signin");

  const nav: (NavItem & { show: boolean })[] = [
    { href: "/report/new", label: "Report an incident", icon: "report", section: "Report", show: can(user.role, "report.submit") },
    { href: "/my-submissions", label: "My submissions", icon: "submissions", section: "Report", show: true },
    { href: "/queue", label: "Active queue", icon: "queue", section: "Work", show: can(user.role, "report.viewAllNew") },
    { href: "/tasks", label: "My tasks", icon: "tasks", section: "Work", show: true },
    { href: "/admin", label: "Administration", icon: "admin", section: "Manage", show: can(user.role, "admin.manageRoles") }
  ];

  return (
    <AppShell
      nav={nav.filter((n) => n.show).map(({ show: _show, ...n }) => n)}
      user={{ name: user.name, email: user.email, role: user.role, department: user.department }}
      demo={!isDurable}
      hosted={Boolean(process.env.VERCEL)}
    >
      {children}
    </AppShell>
  );
}

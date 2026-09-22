import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import AdminTabs from "@/components/admin-tabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) notFound();

  // Allow access if user has any admin permission
  const hasAdminAccess = can(user.role, "admin.manageRoles") ||
                        can(user.role, "admin.manageForms") ||
                        can(user.role, "admin.manageWorkflows") ||
                        can(user.role, "admin.manageGroups");

  if (!hasAdminAccess) notFound();

  return (
    <>
      <AdminTabs
        forms={can(user.role, "admin.manageForms")}
        workflows={can(user.role, "admin.manageWorkflows")}
        groups={can(user.role, "admin.manageGroups")}
      />
      {children}
    </>
  );
}

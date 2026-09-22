import Link from "next/link";
import { currentUser } from "@/lib/session";
import { can, roleLabel, ROLES } from "@/lib/rbac";
import { SectionTitle } from "@/components/ui";
import matrix from "@config/rbac-matrix.json";
import groups from "@config/gatekeeper-groups.json";
import { listAllForms } from "@/lib/forms";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const user = (await currentUser())!;
  const perms = Object.entries(matrix.permissions as Record<string, string[]>);
  const forms = await listAllForms();
  const manageForms = can(user.role, "admin.manageForms");

  return (
    <>
      <SectionTitle note="Forms and workflows are edited here and saved to the datastore. Groups and permissions are configuration files: changing them is a pull request, which gives the rules themselves an approval trail.">
        Administration
      </SectionTitle>

      <div className="grid lg:grid-cols-2 gap-5">
        <div className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Gatekeeper groups</h2>
            {can(user.role, "admin.manageGroups") && <Link href="/admin/groups" className="text-[0.8125rem] text-chart font-medium">Manage groups</Link>}
          </div>
          <ul className="mt-3 space-y-2 text-sm">
            {Object.entries(groups.groups).map(([key, g]) => (
              <li key={key} className="border-b border-line pb-2 last:border-0">
                <p className="font-medium">{g.name}</p>
                <p className="text-[0.8125rem] text-slate1"><span className="id">{key}</span> · {g.members.join(", ")}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-semibold">Which forms each department sees</h2>
            {manageForms && <Link href="/admin/forms" className="text-[0.8125rem] text-chart font-medium">Edit forms</Link>}
          </div>
          <ul className="mt-3 space-y-1.5 text-sm">
            {forms.map((f) => {
              const depts = f.meta.departments ?? [];
              return (
                <li key={f.meta.formId} className="flex justify-between gap-4 border-b border-line py-1.5 last:border-0">
                  <span>
                    {f.meta.title}
                    {f.meta.status === "retired" && <span className="text-slate1"> (retired)</span>}
                  </span>
                  <span className="text-slate1 text-right">{depts.includes("*") ? "All staff" : depts.join(", ") || "Nobody"}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <div className="card p-5 mt-5 overflow-x-auto">
        <h2 className="font-semibold">Permissions</h2>
        <p className="text-[0.8125rem] text-slate1 mt-0.5 mb-4">
          Enforced on the server, not just hidden in the interface.
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="p-2 font-medium">Permission</th>
              {ROLES.map((r) => <th key={r} className="p-2 font-medium text-center">{roleLabel(r)}</th>)}
            </tr>
          </thead>
          <tbody>
            {perms.map(([perm, allowed]) => (
              <tr key={perm} className="border-b border-line last:border-0">
                <td className="p-2 id">{perm}</td>
                {ROLES.map((r) => (
                  <td key={r} className="p-2 text-center">
                    {allowed.includes(r) ? <span className="text-risk-green">Yes</span> : <span className="text-slate1">No</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

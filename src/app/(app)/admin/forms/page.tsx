import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllForms, gatekeeperGroups } from "@/lib/forms";
import { workflowTemplates } from "@/lib/workflow-templates";
import { SectionTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function FormsAdmin() {
  const user = (await currentUser())!;
  if (!can(user.role, "admin.manageForms")) notFound();

  const [forms, templates] = await Promise.all([listAllForms(), workflowTemplates()]);
  const groupName = Object.fromEntries(gatekeeperGroups().map((g) => [g.key, g.name]));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SectionTitle note="Create forms, change their questions, and decide which departments see them. Every save is a new version; reports keep the version they were filed on.">
          Forms
        </SectionTitle>
        <Link href="/admin/forms/new" className="btn-primary">New form</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="p-3 font-medium">Form</th>
              <th className="p-3 font-medium">Who sees it</th>
              <th className="p-3 font-medium">Routes to</th>
              <th className="p-3 font-medium">Workflow</th>
              <th className="p-3 font-medium">Version</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {forms.map((f) => {
              const depts = f.meta.departments ?? [];
              return (
                <tr key={f.meta.formId} className="border-b border-line last:border-0 align-top">
                  <td className="p-3">
                    <p className="font-medium">{f.meta.title}</p>
                    <p className="id text-slate1">{f.meta.code}</p>
                  </td>
                  <td className="p-3 text-slate1">{depts.includes("*") ? "All staff" : depts.join(", ") || "Nobody"}</td>
                  <td className="p-3 text-slate1">{groupName[f.meta.gatekeeperGroup ?? ""] ?? f.meta.gatekeeperGroup}</td>
                  <td className="p-3 text-slate1">{templates.byFormId[f.meta.formId] ? "Own" : "Default"}</td>
                  <td className="p-3">
                    v{f.meta.version ?? 1}
                    {f.meta.updatedAt && (
                      <p className="text-[0.75rem] text-slate1">
                        {new Date(f.meta.updatedAt).toLocaleDateString("en-IN")}{f.meta.updatedBy && `, ${f.meta.updatedBy}`}
                      </p>
                    )}
                  </td>
                  <td className="p-3">
                    {f.meta.status === "retired" ? <span className="text-slate1">Retired</span> : <span className="text-risk-green">Active</span>}
                  </td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/forms/${f.meta.formId}`} className="text-chart font-medium">Edit</Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

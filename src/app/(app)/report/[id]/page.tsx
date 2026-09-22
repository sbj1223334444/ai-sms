import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getReport, listTasks } from "@/lib/store";
import { canWorkOn, holderOf } from "@/lib/ownership";
import { can } from "@/lib/rbac";
import { assignableInvestigators, staffDirectory } from "@/lib/demo-users";
import { getForm } from "@/lib/forms";
import Workspace from "@/components/workspace";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: { id: string } }) {
  const user = (await currentUser())!;
  if (!can(user.role, "workspace.access")) notFound();

  const loaded = await getReport(params.id);
  if (!loaded) notFound();
  const tasks = (await listTasks()).filter((t) => t.reportId === params.id);
  // The form as it stands now; answers filed on an older version are kept even if a question moved on.
  const def = await getForm(loaded.data.formId, { includeRetired: true });

  // Work on an assigned report belongs to whoever holds it; everyone else here can read it.
  const report = loaded.data;
  const work = canWorkOn(user, report);
  const holder = holderOf(report);
  const holderName = holder ? staffDirectory(user).find((p) => p.email === holder)?.name ?? holder : undefined;

  return (
    <Workspace
      report={report}
      tasks={tasks}
      me={{ name: user.name, email: user.email, role: user.role }}
      holder={holder && holder !== user.email ? { email: holder, name: holderName ?? holder } : null}
      permissions={{
        triage: can(user.role, "report.assignInvestigator"),
        reassign: can(user.role, "report.assignInvestigator"),
        investigate: can(user.role, "sra.complete") && work,
        createTask: can(user.role, "task.create") && work,
        sendForApproval: can(user.role, "closure.sendForApproval") && work,
        gatekeeperReview: can(user.role, "closure.gatekeeperReview"),
        approveClosure: can(user.role, "closure.approve"),
        extract: can(user.role, "report.extract"),
        editStages: can(user.role, "workflow.editStages") && work,
        editReport: can(user.role, "report.editSubmitted") && work,
        work
      }}
      investigators={can(user.role, "report.assignInvestigator") ? assignableInvestigators(user) : []}
      directory={can(user.role, "task.create") ? staffDirectory(user) : []}
      form={def ? { schema: def.schema, uiSchema: def.uiSchema } : null}
    />
  );
}

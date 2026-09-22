import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllForms } from "@/lib/forms";
import { workflowTemplates } from "@/lib/workflow-templates";
import { SectionTitle } from "@/components/ui";
import WorkflowManager from "@/components/workflow-manager";

export const dynamic = "force-dynamic";

export default async function WorkflowsAdmin() {
  const user = (await currentUser())!;
  if (!can(user.role, "admin.manageWorkflows")) notFound();
  const [templates, forms] = await Promise.all([workflowTemplates(), listAllForms()]);

  return (
    <>
      <SectionTitle note="The stages a new report starts with. Each report type uses the default unless it has its own. To change one report's stages, use Edit stages on that report's Workflow tab.">
        Workflows
      </SectionTitle>
      <WorkflowManager
        initial={templates}
        forms={forms.map((f) => ({ formId: f.meta.formId, code: f.meta.code, title: f.meta.title, retired: f.meta.status === "retired" }))}
      />
    </>
  );
}

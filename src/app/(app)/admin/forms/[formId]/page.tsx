import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllForms, gatekeeperGroups, DEPARTMENTS } from "@/lib/forms";
import FormEditor from "@/components/form-editor";

export const dynamic = "force-dynamic";

export default async function EditForm({ params }: { params: { formId: string } }) {
  const user = (await currentUser())!;
  if (!can(user.role, "admin.manageForms")) notFound();
  const forms = await listAllForms();
  const def = forms.find((f) => f.meta.formId === params.formId);
  if (!def) notFound();
  return (
    <FormEditor
      key={def.meta.formId}
      initial={def}
      others={forms.filter((f) => f.meta.formId !== def.meta.formId).map((f) => f.meta)}
      departments={DEPARTMENTS}
      groups={gatekeeperGroups()}
    />
  );
}

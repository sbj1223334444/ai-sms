import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { listAllForms, gatekeeperGroups, DEPARTMENTS } from "@/lib/forms";
import FormEditor from "@/components/form-editor";

export const dynamic = "force-dynamic";

export default async function NewForm() {
  const user = (await currentUser())!;
  if (!can(user.role, "admin.manageForms")) notFound();
  const forms = await listAllForms();
  return <FormEditor initial={null} others={forms.map((f) => f.meta)} departments={DEPARTMENTS} groups={gatekeeperGroups()} />;
}

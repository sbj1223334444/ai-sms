import { currentUser } from "@/lib/session";
import { formsForDepartment } from "@/lib/forms";
import { PageHeader } from "@/components/ui";
import FormPicker from "@/components/form-picker";

export const dynamic = "force-dynamic";

export default async function NewReport() {
  const user = (await currentUser())!;
  const forms = await formsForDepartment(user.department);

  return (
    <>
      <PageHeader
        eyebrow="Report"
        title="Report an incident"
        note={`Choose the form that fits what happened. These are the forms available to ${user.department}.`}
      />
      {forms.length === 0 ? (
        <div className="card p-10 text-center text-sm text-slate1">
          No forms are mapped to {user.department} yet. Ask the safety team to map your department in Administration.
        </div>
      ) : (
        <FormPicker forms={forms.map((f) => f.meta)} />
      )}
    </>
  );
}

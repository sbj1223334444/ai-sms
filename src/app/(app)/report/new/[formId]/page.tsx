import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getForm, isVisibleTo } from "@/lib/forms";
import FormRenderer from "@/components/form-renderer";

export const dynamic = "force-dynamic";

export default async function FormPage({ params }: { params: { formId: string } }) {
  const user = (await currentUser())!;
  const def = await getForm(params.formId);
  // A form outside your department, or a retired one, is not reachable by URL either.
  if (!def || !isVisibleTo(def, user.department)) notFound();

  return (
    <FormRenderer
      def={def}
      reporter={{ name: user.name, email: user.email, staffNo: user.staffNo, department: user.department }}
    />
  );
}

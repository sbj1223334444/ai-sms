import { currentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { staffDirectory } from "@/lib/demo-users";
import { getReport, listTasks, storeConfigured } from "@/lib/store";
import { getForm } from "@/lib/forms";
import { sectionForm } from "@/lib/report-edit";
import TaskList, { type SectionExtract } from "@/components/task-list";
import { SectionTitle, Empty } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Tasks() {
  const user = (await currentUser())!;
  const all = storeConfigured() ? await listTasks() : [];
  const mine = all.filter((t) => t.assignee === user.email);
  const raised = all.filter((t) => t.createdBy === user.email);
  // Reassigning a task you raised needs the directory; roles without it keep the rest of the page.
  const directory = can(user.role, "directory.view") ? staffDirectory(user) : [];

  // Only the sections a task grants are sent to the browser: never the rest of the report (US-08 criteria 10, 11).
  const extracts: Record<string, SectionExtract> = {};
  for (const t of mine) {
    if (!t.formEditAccess || !t.editableSections.length || t.status === "accepted") continue;
    const loaded = await getReport(t.reportId);
    const def = loaded ? await getForm(loaded.data.formId, { includeRetired: true }) : null;
    if (!loaded || !def) continue;
    const { schema, uiSchema } = sectionForm(def, t.editableSections);
    const keys = Object.keys(schema.properties as object);
    extracts[t.id] = { schema, uiSchema, data: Object.fromEntries(keys.map((k) => [k, loaded.data.data[k]]).filter(([, v]) => v !== undefined)) };
  }

  return (
    <>
      <SectionTitle note="Anyone in the organisation can hold a safety task. You see the task, not the report behind it, unless you were given edit access to part of it.">
        My tasks
      </SectionTitle>
      {mine.length === 0 && raised.length === 0 ? (
        <Empty title="No tasks assigned to you." />
      ) : (
        <TaskList mine={mine} raised={raised} extracts={extracts} directory={directory} myEmail={user.email} />
      )}
    </>
  );
}

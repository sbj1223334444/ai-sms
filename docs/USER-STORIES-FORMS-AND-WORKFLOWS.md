# Form editor and workflow manager — user stories

US-16 to US-19. They extend the fifteen stories in the epic pack.

## Scope change

The BRD listed two things as out of scope: an in-app form editor, and adding, deleting or
reordering workflow stages. The product owner brought both into scope on 19 September 2026.
US-07 changes with them: default stages are now configurable per report type, and stages on a
single report can change while it is under investigation.

## Who "admin" is

The **Admin** and **System Admin** roles. Three new permissions sit in the RBAC matrix
(`config/rbac-matrix.json`) and are enforced on the server:

| Permission | Admin | System Admin | Everyone else |
|---|---|---|---|
| `admin.manageForms` | Yes | Yes | No |
| `admin.manageWorkflows` | Yes | Yes | No |
| `workflow.editStages` | Yes | Yes | No |

Widening any of them (for example letting gatekeepers edit stages on a report) is a change to that
file, not to code.

---

## US-16 Build and edit report forms

**As an** administrator
**I want to** create new report forms and change existing ones inside the app
**so that** the safety team can change what reporters are asked without waiting for a release.

**Acceptance criteria**

1. *Administration → Forms* lists every form, active and retired, with its code, title, who sees
   it, the gatekeeper group it routes to, its version and when it was last changed.
2. *New form* asks for a title, a code, a one-line summary, whether it can be filed
   confidentially, whether an attachment is required, and the gatekeeper group it routes to.
   The form ID is derived from the title and cannot change after the first save.
3. Fields can be added at a position, edited, removed and moved up or down. *Insert here* sits
   between every pair of questions, and in the gap between two sections, so a question goes
   straight where it belongs instead of being added at the end and walked up. The list shows the
   section each question sits in, and an inserted question joins the section shown above it.
   Field types: short text, long text,
   number, whole number, date, time, dropdown, single choice buttons, multiple choice, and a
   Yes / No preset. Every field has a label, a required switch and optional help text. Choice
   fields have options. Text fields can have a character limit. Number fields can have a minimum
   and a maximum.
4. A field's storage key is generated from its label when the field is added. Once the form is
   saved, the key is fixed, so reports already filed stay aligned with the form.
5. Fields the builder cannot represent — repeating sections, nested groups, and the conditional
   branches some forms use — are shown as *advanced*. They are kept exactly as they are on save
   and can be changed in the JSON view.
6. A live preview shows the form as a reporter will see it, updating with every change.
7. Saving checks the form first: title and code present, code not used by another form, at least
   one field, unique keys, options on every choice field, a sensible character limit and number
   range, and a schema that compiles. Every problem is listed, and nothing is saved until all are
   fixed.
8. Every save adds one to the form's version. A report records the version it was filed on.
   Reports filed on an earlier version keep their answers and still display in full.
9. Forms are retired, not deleted. A retired form disappears from the picker, cannot be opened by
   URL, and cannot be submitted. Reports already filed on it are untouched. It can be reactivated.
10. Only Admin and System Admin see the editor. Every other role is refused by the API as well as
    the interface.
11. Saving a form that has not been changed produces exactly the form that was loaded. None of the
    thirteen shipped forms are altered by opening and saving them.
12. The common fields the BRD fills from the account - name, email, staff number and department -
    are not part of any form and cannot be added to one. Every form shows them at the top,
    read-only, and drops them entirely when the reporter marks the report confidential.

## US-17 Control who sees each form

**As an** administrator
**I want to** choose which departments see each form
**so that** reporters only see the forms that apply to their work.

**Acceptance criteria**

1. Each form is visible to *All staff* or to a chosen set of departments, taken from the
   department master list.
2. A change takes effect straight away in the form picker, on direct URL access and in the
   submission API. All three are checked on the server.
3. An active form must be visible to at least one department.
4. The Administration overview shows each form's current visibility.

## US-18 Manage default workflows per report type

**As an** administrator
**I want to** edit the default workflow stages for each report type
**so that** new reports follow the process that suits their type.

**Acceptance criteria**

1. *Administration → Workflows* shows the default workflow and every report type, and marks which
   types have a workflow of their own.
2. On any workflow: add a stage, remove a stage, rename a stage, change its target days (1 to
   365), and move it up or down.
3. *Report Review* is always first and *Closure Approval* always last, because triage completes
   the first and closure approval completes the last. Both can be renamed and have their days
   changed, but cannot be removed or moved.
4. A report type without a workflow of its own uses the default. A type can be given its own
   workflow, starting as a copy of the default, and can be sent back to the default.
5. Changes apply to reports submitted after the save. Reports already filed keep their stages.
6. Only Admin and System Admin can change workflows.

## US-19 Adjust the stages on a report under investigation

**As an** administrator
**I want to** add, remove and reorder the stages on one report while it is under investigation
**so that** the workflow follows what that investigation actually needs.

**Acceptance criteria**

1. On a report that is *In progress*, the Workflow tab offers *Edit stages* to anyone holding
   `workflow.editStages`.
2. Completed stages and the stage in progress are locked. So is *Closure Approval*.
3. Stages that have not started can be renamed, have their days changed, be removed, and be moved
   up or down among themselves. They cannot be moved above the stage in progress or below
   *Closure Approval*.
4. New stages can be added after the stage in progress and before *Closure Approval*.
5. The target dates of stages that have not started are recalculated in order, each from the
   deadline of the stage before it.
6. Each save adds one entry to the report's timeline, listing what changed: stages added,
   removed, renamed, re-timed or reordered.
7. The server applies the same rules. A request that changes a locked stage is refused.
8. Changing one report's stages does not change the workflow for its report type.
9. A stage that was completed too early can be reopened by whoever holds the report, with a reason
   that goes on the Timeline. It returns to *In progress* keeping everything written at it, and
   every stage after it starts again, because the workflow runs in order. Only while the report is
   *In progress*: once it is with an approver, the approver sends it back instead. *Closure
   Approval* is never reopened from here.

---

## Storage

Form and workflow configuration is saved to the datastore under `data/config/`, alongside
reports. The files in `config/forms/` and `config/workflows.json` are the starting point: until
something is saved from the editor, the app reads them unchanged.

- **GitHub store:** every save is a commit authored by the administrator, so the change history
  of a form or a workflow is its `git log`.
- **Demo mode (in memory):** changes last until the server restarts, and on Vercel each server
  instance holds its own copy. This is the same limit that applies to reports in demo mode.

## Not in this change

- A visual builder for conditional logic ("show field X when Y is Yes"). Use the JSON view.
- A draft, review and publish cycle for forms. A save publishes immediately.
- Visibility by role. Visibility is by department, as in BRD section 6.
- Deleting forms. Retire them instead.
- Editing gatekeeper groups and their members. Still configuration files.

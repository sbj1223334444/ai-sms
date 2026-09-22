/* Rules that protect a safety decision. Run with: npm run check */
import fs from "fs";
import path from "path";
import { checkMitigation, needsApproval, zoneOf } from "../risk";
import { applyStageEdits, buildWorkflow, closureReadiness, normaliseTemplate, reopenStage } from "../workflow";
import { canWorkOn, holderOf, workBlockedReason } from "../ownership";
import { isTaskEditable, isTaskOpen } from "../tasks";
import { can } from "../rbac";
import { assignableInvestigators } from "../demo-users";
import { fieldsToForm, formToFields, newField, fieldKeyFrom, validateForm } from "../form-builder";
import { diffAnswers, editableSections, sectionFields, sectionForm, reportEditable, withClears } from "../report-edit";
import { normaliseSra, reviewDateFor, sraClosureBlockers, sraContents, sraProblems, syncSras } from "../sra";
import { TASK_TYPES } from "../tasks";
import type { FormDef, Report, WorkflowStage } from "../types";

let failed = 0;
function ok(name: string, cond: boolean) {
  console.log(`${cond ? "  pass" : "  FAIL"}  ${name}`);
  if (!cond) failed++;
}

console.log("\nRisk matrix");
ok("5A sits in the red zone", zoneOf("5A") === "red");
ok("1E sits in the green zone", zoneOf("1E") === "green");
ok("raising probability after mitigation is blocked", !checkMitigation("3C", "4C").ok);
ok("worsening severity after mitigation is blocked", !checkMitigation("3C", "3B").ok);
ok("reducing probability is allowed", checkMitigation("4C", "2C").ok);
ok("reducing severity warns before it is accepted", Boolean(checkMitigation("4B", "2D").warn));
ok("leaving the rating unchanged neither blocks nor warns", checkMitigation("2D", "2D").ok && !checkMitigation("2D", "2D").warn);
ok("red residual risk escalates past an investigator", needsApproval("5A", "investigator"));
ok("green residual risk does not escalate", !needsApproval("1E", "investigator"));
ok("orange escalates for an investigator but not for COFS", needsApproval("3B", "investigator") && !needsApproval("3B", "cofs"));

console.log("\nWorkflow");
const wf = buildWorkflow("voluntary-safety-report", "2026-09-01T00:00:00.000Z");
ok("five stages are seeded", wf.length === 5);
ok("the first stage opens in progress", wf[0].status === "in_progress");
ok("report review targets two days out", wf[0].targetDate === "2026-09-03");
ok("investigation chains ten days from report review", wf[1].targetDate === "2026-09-13");
ok("closure approval lands seven days after findings", wf[4].targetDate === "2026-09-22");

console.log("\nClosure gate");
const bare = { workflow: wf, triage: { decision: "investigation_sra" }, sras: [] } as unknown as Report;
const gate = closureReadiness(bare, 2);
ok("closure is blocked before the work is done", !gate.ok);
ok("open tasks are named as a blocker", gate.blockers.some((b) => b.includes("task")));
ok("a missing risk assessment is named as a blocker", gate.blockers.some((b) => b.includes("risk assessment")));

const complete = {
  workflow: wf.map((s) => ({ ...s, status: "complete" })),
  triage: { decision: "investigation_sra" },
  investigation: { synopsis: "x", analysis: "y", recommendations: "z", findings: [{ id: "F1", text: "f", sraRequired: true }] },
  sras: [
    {
      id: "SRA-F1",
      title: "t",
      findingRef: "F1",
      hazards: [{ id: "H1", hazard: "h", controls: [] }],
      preMitigation: "4B",
      postMitigation: "2D",
      action: "Retrain the ramp team",
      owner: "owner@demo.contrail",
      deadline: "2026-12-31",
      approval: { status: "not_required" }
    }
  ]
} as unknown as Report;
ok("closure opens once everything is complete", closureReadiness(complete, 0).ok);
ok(
  "an assessment with no rating, action, owner or deadline blocks closure",
  closureReadiness({ ...complete, sras: [{ id: "SRA-F1", title: "t", hazards: [{ id: "H1", hazard: "h", controls: [] }] }] } as unknown as Report, 0).blockers.length === 4
);

console.log("\nWho holds a report");
const assigned = { triage: { decision: "investigation_sra", investigator: "arjun@demo.contrail" } } as unknown as Report;
const keeper = { email: "gatekeeper@demo.contrail", role: "gatekeeper" as const };
const nodal = { email: "arjun@demo.contrail", role: "investigator" as const };
ok("the investigator it was handed to does the work", canWorkOn(nodal, assigned));
ok("the gatekeeper who assigned it does not", !canWorkOn(keeper, assigned));
ok("another investigator does not either", !canWorkOn({ email: "someone@demo.contrail", role: "investigator" }, assigned));
ok("an administrator can always step in", canWorkOn({ email: "admin@demo.contrail", role: "system_admin" }, assigned));
ok("an unassigned report is open to the roles that can act on it", canWorkOn(keeper, { triage: undefined } as unknown as Report));
ok("a rejected report has no holder", holderOf({ triage: { decision: "reject", investigator: "x@y.z" } } as unknown as Report) === undefined);
ok("the refusal names who holds it", (workBlockedReason(keeper, assigned, "Arjun Deshmukh") ?? "").includes("Arjun Deshmukh"));

console.log("\nReopening a stage");
const done = buildWorkflow("voluntary-safety-report", "2026-09-01T00:00:00.000Z").map((s, i) =>
  i <= 2 ? { ...s, status: "complete" as const, completedAt: "2026-09-10T00:00:00.000Z" } : i === 3 ? { ...s, status: "in_progress" as const } : s
);
const back = reopenStage(done, done[1].key);
ok("a completed stage goes back in progress", back.ok && back.stages[1].status === "in_progress" && !back.stages[1].completedAt);
ok("every stage after it starts again", back.ok && back.stages.slice(2).every((s) => s.status === "not_started"));
ok("and the ones before it are untouched", back.ok && back.stages[0].status === "complete");
ok("what was reopened alongside it is named", back.ok && back.alsoReset.length === 2);
ok("a stage that is not complete cannot be reopened", !reopenStage(done, done[3].key).ok);
ok("closure approval is not reopened from the workflow tab", !reopenStage(done, "closure").ok);

console.log("\nTasks and their stage");
ok("a deleted task stops holding up its stage and closure", !isTaskOpen("cancelled") && !isTaskOpen("accepted") && isTaskOpen("open"));
ok("a task can be changed or deleted until it is accepted", isTaskEditable("submitted") && !isTaskEditable("accepted") && !isTaskEditable("cancelled"));

console.log("\nAccess control");
ok("only COFS and System Admin approve closure", can("cofs", "closure.approve") && can("system_admin", "closure.approve") && !can("gatekeeper", "closure.approve"));
ok("an investigator cannot assign an investigator", !can("investigator", "report.assignInvestigator"));
ok("a reporter cannot open the workspace", !can("reporter", "workspace.access"));
ok("everyone can hold and complete a task", can("reporter", "task.complete"));
ok("only System Admin reads the audit log", can("system_admin", "admin.auditLogs") && !can("admin", "admin.auditLogs"));

console.log("\nAssignment");
const offered = assignableInvestigators();
ok("investigators and gatekeepers are both offered", offered.some((p) => p.role === "investigator") && offered.some((p) => p.role === "gatekeeper"));
ok("nobody else is offered", offered.every((p) => p.role === "investigator" || p.role === "gatekeeper"));
const guest = { name: "Guest", email: "guest@demo.contrail", department: "Corporate Safety", scope: "all" as const };
ok(
  "a gatekeeper signed in as themselves is offered, a reporter is not",
  assignableInvestigators({ ...guest, role: "gatekeeper" }).some((p) => p.email === guest.email) &&
    !assignableInvestigators({ ...guest, role: "reporter" }).some((p) => p.email === guest.email)
);

console.log("\nForm editor");
const shipped = fs
  .readdirSync(path.join("config", "forms"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join("config", "forms", f), "utf8")) as FormDef);
const unchanged = shipped.filter((def) => {
  const again = fieldsToForm(def, def.meta, formToFields(def));
  return JSON.stringify(again.schema) === JSON.stringify(def.schema) && JSON.stringify(again.uiSchema) === JSON.stringify(def.uiSchema);
});
ok(`opening and saving each shipped form changes nothing (${unchanged.length}/${shipped.length})`, shipped.length > 0 && unchanged.length === shipped.length);

const bird = shipped.find((d) => d.meta.formId === "bird-strike")!;
const birdFields = formToFields(bird);
const added = newField("select", "Wind strength", birdFields.map((f) => f.key), ["09", "27"]);
const withField = fieldsToForm(bird, bird.meta, [...birdFields, { ...added, required: true }]);
ok(
  "an added field lands in the schema, the required list and nowhere else",
  (withField.schema.properties as Record<string, { enum?: string[] }>).windStrength?.enum?.join() === "09,27" &&
    (withField.schema.required as string[]).includes("windStrength") &&
    JSON.stringify((withField.schema.properties as Record<string, unknown>).remarks) === JSON.stringify((bird.schema.properties as Record<string, unknown>).remarks)
);
ok("field keys come from the label and never collide", fieldKeyFrom("Date of strike", ["dateOfStrike"]) === "dateOfStrike2");

const vsr = shipped.find((d) => d.meta.formId === "voluntary-safety-report")!;
type Section = { title: string; fields?: string[] };
const vsrFields = formToFields(vsr);
const sectionsOf = (def: FormDef) => def.uiSchema["ui:groups"] as Section[];
const eventBefore = sectionsOf(vsr)[1].fields!;
const withinSection = sectionsOf(fieldsToForm(vsr, vsr.meta, [vsrFields[0], vsrFields[2], vsrFields[1], ...vsrFields.slice(3)]))[1].fields!;
ok(
  "reordering within a section keeps conditional questions in place",
  withinSection[0] === eventBefore[1] && withinSection[1] === eventBefore[0] && withinSection.indexOf("flightNo") === eventBefore.indexOf("flightNo")
);
const acrossSections = sectionsOf(fieldsToForm(vsr, vsr.meta, [vsrFields[1], vsrFields[0], ...vsrFields.slice(2)]));
ok("moving a field past the edge of its section moves it into the next one", acrossSections[0].fields![0] === "station" && acrossSections[1].fields![0] === "confidential");
const everyShippedFieldInASection = shipped.every((d) => {
  const placed = new Set(sectionsOf(d).flatMap((g) => g.fields ?? []));
  return Object.keys(d.schema.properties as object).every((k) => placed.has(k));
});
ok("every question on every shipped form sits in a section", everyShippedFieldInASection);

const ctx = { others: shipped.map((d) => d.meta), departments: ["Flight Operations"], groups: ["safety-flight-ops"], isNew: true };
const draft: FormDef = {
  meta: { formId: "bird-strike", code: "WLD-001", title: "Copy", summary: "", supportsConfidential: true, attachmentsRequired: false, departments: [], gatekeeperGroup: "safety-flight-ops" },
  schema: { type: "object", properties: { pick: { type: "string", title: "Pick", enum: [] } } },
  uiSchema: {}
};
const problems = validateForm(draft, ctx);
ok(
  "saving is refused for a taken ID and code, no visibility, an empty choice and a missing confidential field",
  ["already exists", "already used", "at least one department", "at least one option", "confidential"].every((p) => problems.some((e) => e.includes(p)))
);

console.log("\nWorkflow manager");
ok("a template must keep Report Review first", !normaliseTemplate([{ key: "closure", name: "Closure", taskDays: 1 }]).ok);
const tmpl = normaliseTemplate([
  { key: "report-review", name: "Report Review", taskDays: 2 },
  { key: "", name: "Site visit", taskDays: 3 },
  { key: "closure", name: "Closure Approval", taskDays: 7 }
]);
ok("a new template stage gets a key from its name", tmpl.ok && tmpl.stages[1].key === "site-visit");

const live: WorkflowStage[] = wf.map((s, i) => ({ ...s, status: i === 0 ? "complete" : i === 1 ? "in_progress" : "not_started" }));
const asTemplate = (stages: WorkflowStage[]) => stages.map(({ key, name, taskDays }) => ({ key, name, taskDays }));
const tpl = asTemplate(live);
ok("a stage in progress cannot be removed from a live report", !applyStageEdits(live, [tpl[0], ...tpl.slice(2)]).ok);
ok("a completed stage cannot be renamed", !applyStageEdits(live, [{ ...tpl[0], name: "Renamed" }, ...tpl.slice(1)]).ok);
ok("Closure Approval must stay last", !applyStageEdits(live, [...tpl.slice(0, 2), tpl[4], tpl[2], tpl[3]]).ok);
const edited = applyStageEdits(live, [tpl[0], tpl[1], { key: "", name: "Expert review", taskDays: 4 }, tpl[3], tpl[2], tpl[4]]);
ok(
  "stages not started can be added and reordered, and their dates follow in order",
  edited.ok &&
    edited.stages.map((s) => s.name).join("|") === "Report Review|Investigation|Expert review|Findings and Actions|Investigation Meeting Minutes|Closure Approval" &&
    edited.stages[2].targetDate > edited.stages[1].targetDate &&
    edited.stages[5].targetDate > edited.stages[4].targetDate &&
    edited.changes.some((c) => c.includes("added")) &&
    edited.changes.some((c) => c.includes("reordered"))
);
ok("an unchanged list is refused as nothing changed", !applyStageEdits(live, tpl).ok);

const groupsOf = (def: FormDef) => (def.uiSchema["ui:groups"] as { title: string; fields?: string[] }[] | undefined) ?? [];
const ordered = formToFields(vsr);
const midway = Math.min(2, ordered.length);
const inserted = fieldsToForm(
  vsr,
  vsr.meta,
  [...ordered.slice(0, midway), newField("text", "Inserted question", ordered.map((f) => f.key)), ...ordered.slice(midway)]
);
const insertedKey = formToFields(inserted)[midway]?.key;
ok("a field inserted between two questions stays where it was put", insertedKey === "insertedQuestion");
ok(
  "and joins the section it was inserted into, not the last one",
  groupsOf(inserted).find((g) => (g.fields ?? []).includes("insertedQuestion"))?.title === groupsOf(vsr).find((g) => (g.fields ?? []).includes(ordered[midway - 1].key))?.title
);

console.log("\nEditing a submitted report");
const answers = { confidential: "No", station: "BOM", description: "Bird hit", speciesSeen: "Kite" };
const edit = diffAnswers(answers, withClears(answers, { confidential: "Yes", station: "DEL", description: "Bird hit" }), { station: "Station", speciesSeen: "Species" });
ok("an answer left out of a request is left alone", diffAnswers(answers, { station: "DEL" }, {}, ["station", "description"]).data.description === "Bird hit");
ok("the confidentiality choice cannot be changed after submission", edit.data.confidential === "No" && !edit.changes.some((c) => c.field === "confidential"));
ok(
  "every changed answer is recorded with its old and new value",
  edit.changes.length === 2 && edit.changes.some((c) => c.label === "Station" && c.from === "BOM" && c.to === "DEL") && !("speciesSeen" in edit.data)
);
const viaTask = diffAnswers(answers, { station: "DEL", description: "Changed" }, {}, ["description"]);
ok("a task assignee can change only the sections the task grants", viaTask.data.station === "BOM" && viaTask.data.description === "Changed" && viaTask.changes.length === 1);
const vsrSections = editableSections(vsr);
ok("edit access is offered by section, not question by question", vsrSections.length > 0 && vsrSections.every((sec) => sec.fields.length > 0));
ok(
  "the sections are the form's own numbered cards",
  vsrSections.map((sec) => sec.label).join("|") ===
    (vsr.uiSchema["ui:groups"] as Section[]).filter((g) => (g.fields ?? []).some((k) => k !== "confidential")).map((g) => g.title).join("|")
);
ok("the confidentiality question is never offered for editing", !vsrSections.some((sec) => sec.fields.includes("confidential")));
const oneSection = sectionForm(vsr, [vsrSections[0].key]);
ok(
  "a task shows the assignee that section's questions and nothing else",
  Object.keys(oneSection.schema.properties as object).join() === vsrSections[0].fields.join()
);
ok("a task raised before sections existed still resolves its questions", sectionFields(vsr, ["description", "notAField"]).join() === "description");
ok(
  "answers are editable on an Investigation + SRA report in progress, read-only for SRA only",
  reportEditable({ status: "in_progress", triage: { decision: "investigation_sra" } } as unknown as Report) &&
    !reportEditable({ status: "in_progress", triage: { decision: "sra_only" } } as unknown as Report) &&
    !reportEditable({ status: "closed", triage: { decision: "investigation_sra" } } as unknown as Report)
);

console.log("\nSRA tabs follow the findings");
const finding = (id: string, sraRequired: boolean) => ({ id, text: `Finding ${id}`, sraRequired });
const first = syncSras("investigation_sra", [finding("F1", true), finding("F2", false)], []);
ok("only a finding flagged for assessment gets an SRA", first.sras.length === 1 && first.sras[0].findingRef === "F1");
ok("an unflagged finding never opens one", !first.sras.some((s) => s.findingRef === "F2"));
const withRisk = [{ ...first.sras[0], hazards: [{ id: "H1", hazard: "h", controls: [{ id: "C1", text: "c", kind: "existing" as const }] }], preMitigation: "4B" }];
const unflagged = syncSras("investigation_sra", [finding("F1", false), finding("F2", false)], withRisk);
ok("unticking the flag deletes the assessment, risk data and all", unflagged.sras.length === 0 && unflagged.removed.length === 1);
ok("what is about to be lost can be named before it goes", sraContents(withRisk[0]).join(", ") === "1 hazard, 1 control, its risk rating");
const deleted = syncSras("investigation_sra", [finding("F2", false)], withRisk);
ok("deleting the finding deletes its assessment too", deleted.sras.length === 0 && deleted.removed[0].findingRef === "F1");
ok("a second flagged finding gets its own assessment, with its own risk index", syncSras("investigation_sra", [finding("F1", true), finding("F2", true)], withRisk).sras.length === 2);
ok("an SRA-only report has exactly one assessment from acceptance", syncSras("sra_only", [], []).sras.length === 1);
ok("a database-only report has none", syncSras("database_only", [finding("F1", true)], withRisk).sras.length === 0);
ok(
  "an assessment saved with the rating on its hazards still loads",
  normaliseSra({ id: "SRA-1", title: "t", hazards: [{ id: "H1", hazard: "h", controls: [], preMitigation: "4B", postMitigation: "2D" }] }).postMitigation === "2D"
);
ok("the review date is the last business day of the period", reviewDateFor("3 Months", new Date("2026-01-15T00:00:00Z")) === "2026-04-30");
ok("a period with no date gives none", reviewDateFor("After the Flight") === undefined);
const thin = { id: "SRA-1", title: "t", hazards: [{ id: "H1", hazard: "", controls: [] }] };
ok("a hazard needs a name, a root cause, a resultant risk, an effect and both kinds of control", sraProblems(thin as never).length === 9);
ok("closing the action asks for a review period and effectiveness", sraProblems({ ...thin, status: "Closed" } as never).some((p) => p.includes("review period")));
ok("a pending risk acceptance blocks closure", sraClosureBlockers({ id: "S", title: "t", hazards: [], approval: { required: true, status: "pending", approver: "a@b.c" } } as never).some((b) => b.includes("awaiting")));

console.log("\nTasks");
ok(
  "the four BRD task purposes are all offered, in order",
  TASK_TYPES.map((t) => t.type).join() === "reporter_info,form_edit,company_info,action"
);
ok("a reporter request goes to the reporter; a control or action never opens the form", TASK_TYPES[0].assignee === "reporter" && TASK_TYPES[3].formEdit === "none");

console.log(failed ? `\n${failed} check(s) failed\n` : "\nAll checks passed\n");
process.exit(failed ? 1 : 0);

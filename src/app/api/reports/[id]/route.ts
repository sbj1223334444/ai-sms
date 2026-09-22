import { NextRequest, NextResponse } from "next/server";
import { currentUser, commitAuthor } from "@/lib/session";
import { getReport, putReport, nextId, listTasks, reportHistory } from "@/lib/store";
import { can } from "@/lib/rbac";
import { assignableInvestigators } from "@/lib/demo-users";
import { getForm, extraValidation } from "@/lib/forms";
import { describeChanges, diffAnswers, fieldLabels, recordEdit, reportEditable } from "@/lib/report-edit";
import { isTaskOpen } from "@/lib/tasks";
import { advance, applyStageEdits, closureReadiness, reopenStage } from "@/lib/workflow";
import { checkMitigation, needsApproval, approverFor } from "@/lib/risk";
import { normaliseSra, originatorOf, reviewDateFor, sraContents, sraProblems, syncSras } from "@/lib/sra";
import { canWorkOn, holderOf, workBlockedReason } from "@/lib/ownership";
import { notify } from "@/lib/notify";
import type { Finding, Report, Sra, TimelineEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

function stamp(report: Report, actor: string, action: string, detail?: string) {
  const entry: TimelineEntry = { at: new Date().toISOString(), actor, action, detail };
  report.timeline = [...report.timeline, entry];
}

/**
 * Keep the SRA tabs in step with the findings (US-05 criteria 2 and 3). Dropping a finding, or
 * unticking "needs a safety risk assessment", deletes that assessment and everything in it; the
 * timeline records what went. Any risk acceptance waiting on a deleted assessment goes with it.
 */
function applySraSync(report: Report, actor: string, findings: Finding[]) {
  const { sras, removed } = syncSras(report.triage?.decision, findings, report.sras);
  report.sras = sras;
  for (const gone of removed) {
    const held = sraContents(gone);
    stamp(report, actor, "SRA removed", `${gone.id} "${gone.title}"${held.length ? ` (lost ${held.join(", ")})` : ""}`);
  }
  if (report.status === "pending_risk_approval" && !sras.some((s) => s.approval?.status === "pending")) {
    report.status = "in_progress";
  }
  return removed;
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const loaded = await getReport(params.id);
  if (!loaded) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const tasks = (await listTasks()).filter((t) => t.reportId === params.id);
  const audit = can(user.role, "admin.auditLogs") ? await reportHistory(params.id) : [];
  return NextResponse.json({ report: loaded.data, tasks, audit });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const loaded = await getReport(params.id);
  if (!loaded) return NextResponse.json({ error: "Report not found" }, { status: 404 });

  const report = loaded.data;
  const author = commitAuthor(user);
  const body = await req.json();
  const action = body.action as string;
  let message = "";

  // Everything that fills the report in belongs to whoever holds it (see lib/ownership).
  const WORK_ACTIONS = [
    "editReport",
    "saveInvestigation",
    "saveSra",
    "completeStage",
    "reopenStage",
    "editStages",
    "submitClosure",
    "saveAircraftAndCrew",
    "effectivenessReview"
  ];
  if (WORK_ACTIONS.includes(action) && !canWorkOn(user, report)) {
    const holderName = assignableInvestigators(user).find((p) => p.email === holderOf(report))?.name;
    return NextResponse.json({ error: workBlockedReason(user, report, holderName) }, { status: 403 });
  }

  switch (action) {
    /* ---------- Gatekeeper triage (BRD 3.2) ---------- */
    case "triage": {
      if (!can(user.role, "report.assignInvestigator")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      if (report.status !== "new") return NextResponse.json({ error: "This report has already been triaged." }, { status: 409 });

      const decision = body.decision as Report["triage"] extends undefined ? never : "investigation_sra" | "sra_only" | "database_only" | "reject";
      if (decision === "reject" && !body.comment?.trim()) {
        return NextResponse.json({ error: "A comment is mandatory when rejecting a report." }, { status: 422 });
      }
      if (decision !== "reject" && !body.investigator) {
        return NextResponse.json({ error: "Assign an investigator or SMS nodal before accepting." }, { status: 422 });
      }
      const assignee = assignableInvestigators(user).find((p) => p.email === body.investigator);
      if (decision !== "reject" && !assignee) {
        return NextResponse.json({ error: "Pick an investigator, SMS nodal or gatekeeper from the list." }, { status: 422 });
      }

      report.triage = {
        decision,
        operationalHazard: Boolean(body.operationalHazard),
        comment: body.comment,
        by: user.name,
        at: new Date().toISOString(),
        investigator: decision === "reject" ? undefined : body.investigator
      };

      if (decision === "reject") {
        report.status = "rejected";
        stamp(report, user.name, "Report rejected", body.comment);
        message = `feat(triage): reject ${report.id}`;
      } else {
        // The safety reference series only ever covers accepted reports.
        const seq = await nextId("safetyRef", author);
        report.safetyRef = `SR-${new Date().getFullYear()}-${String(seq).padStart(5, "0")}`;
        report.status = "in_progress";
        report.workflow = advance(report.workflow, "report-review", user.email);
        // An SRA-only report has one assessment from the moment it is accepted; on an
        // Investigation + SRA report the assessments follow the findings instead.
        report.sras = syncSras(decision, [], report.sras).sras;
        stamp(report, user.name, `Accepted for ${decision.replace("_", " + ")}`, `Assigned to ${assignee?.name ?? body.investigator}. Safety ref ${report.safetyRef}`);

        // CAE is not connected on this build, so crew and aircraft are entered by hand in the
        // workspace. See src/lib/cae.ts for what changes when access arrives.
        message = `feat(triage): accept ${report.id} as ${decision} -> ${report.safetyRef}`;

        await notify({
          to: body.investigator,
          subject: `Investigation assigned - ${report.safetyRef}`,
          body: `${user.name} has assigned you a ${report.formTitle} for ${decision.replace("_", " + ")}.`,
          link: `${req.nextUrl.origin}/report/${report.id}`
        });
      }
      break;
    }

    /* ---------- Correct the reporter's answers (US-04 criteria 3, 12, 13) ---------- */
    case "editReport": {
      if (!can(user.role, "report.editSubmitted")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      if (!reportEditable(report)) {
        return NextResponse.json(
          { error: "The report can be edited only while an Investigation + SRA is in progress. SRA-only and database-only reports are read-only." },
          { status: 409 }
        );
      }
      if (typeof body.data !== "object" || body.data === null || Array.isArray(body.data)) {
        return NextResponse.json({ error: "Send the report's answers." }, { status: 400 });
      }
      const def = await getForm(report.formId, { includeRetired: true });
      const { data, changes } = diffAnswers(report.data, body.data, fieldLabels(def));
      if (!changes.length) return NextResponse.json({ error: "Nothing changed." }, { status: 422 });
      const problems = def ? extraValidation(def, data) : [];
      if (problems.length) return NextResponse.json({ error: problems.join(" ") }, { status: 422 });

      const at = new Date().toISOString();
      recordEdit(report, data, { at, by: user.name, changes });
      stamp(report, user.name, "Report details edited", describeChanges(changes));
      message = `chore(report): edit ${changes.length} answer(s) on ${report.id}`;
      break;
    }

    /* ---------- Investigation record (BRD 9) ---------- */
    case "saveInvestigation": {
      if (!can(user.role, "workspace.access")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      if (report.triage?.decision !== "investigation_sra") {
        return NextResponse.json({ error: "Investigation fields are only available for reports accepted as Investigation + SRA." }, { status: 409 });
      }
      const findings = ((body.investigation?.findings ?? []) as Finding[]).map((f, i) => ({ ...f, id: f.id || `F${i + 1}` }));
      if (findings.length > 15) return NextResponse.json({ error: "A maximum of 15 findings can be recorded." }, { status: 422 });
      const ids = findings.map((f) => f.id);
      if (new Set(ids).size !== ids.length) return NextResponse.json({ error: "Two findings share the same reference. Reload the report and try again." }, { status: 409 });

      report.investigation = { ...body.investigation, findings, updatedAt: new Date().toISOString() };

      // Each finding flagged for assessment has its own SRA tab; unflagging one deletes it.
      const removed = applySraSync(report, user.name, findings);
      stamp(report, user.name, "Investigation updated", `${findings.length} finding(s), ${report.sras.length} assessment(s)`);
      message = `chore(investigation): update ${report.id}`;
      if (removed.length) message += ` (-${removed.length} sra)`;
      break;
    }

    /* ---------- Safety risk assessment (BRD 7) ---------- */
    case "saveSra": {
      if (!can(user.role, "sra.complete")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      const incoming = normaliseSra(body.sra as Sra);
      const idx = report.sras.findIndex((s) => s.id === incoming.id);
      if (idx === -1) {
        return NextResponse.json(
          { error: "That assessment is not on this report. SRA tabs follow the findings marked as needing one." },
          { status: 404 }
        );
      }
      const previous = report.sras[idx];

      for (const h of incoming.hazards) {
        if (!h.id) h.id = `HZ-${report.id.slice(-6)}-${await nextId("hazard", author)}`;
        for (const c of h.controls) if (!c.id) c.id = `CTL-${report.id.slice(-6)}-${await nextId("control", author)}`;
      }

      // The risk index belongs to the assessment, so the BRD 7 rules are checked once.
      if (incoming.preMitigation && incoming.postMitigation) {
        const check = checkMitigation(incoming.preMitigation, incoming.postMitigation);
        if (!check.ok) return NextResponse.json({ error: check.blocked, sraId: incoming.id }, { status: 422 });
        if (check.warn && !incoming.severityOverrideAccepted) {
          return NextResponse.json({ warn: check.warn, sraId: incoming.id, requiresConfirmation: true }, { status: 409 });
        }
        if (check.warn && incoming.severityOverrideAccepted && previous.postMitigation !== incoming.postMitigation) {
          stamp(report, user.name, "Severity reduction accepted", `${incoming.id}: ${incoming.preMitigation} to ${incoming.postMitigation}`);
        }
      }

      // Stamped, never typed: the register position, the originator and the review date.
      incoming.serial = idx + 1;
      incoming.originator = originatorOf(report);
      incoming.dateAddedToRegister = previous.dateAddedToRegister ?? incoming.dateAddedToRegister ?? new Date().toISOString().slice(0, 10);
      if (incoming.status === "Closed") {
        const periodChanged = previous.reviewPeriod !== incoming.reviewPeriod;
        incoming.reviewDate = periodChanged || !previous.reviewDate ? reviewDateFor(incoming.reviewPeriod) : previous.reviewDate;
      } else {
        delete incoming.reviewDate;
      }

      // Residual risk above the investigator's tolerance routes to the configured approver, unless
      // the same index has already been accepted.
      const post = incoming.postMitigation;
      const settled = previous.approval?.status === "approved" && previous.postMitigation === post;
      if (settled) {
        incoming.approval = previous.approval;
      } else if (post && needsApproval(post, user.role)) {
        const approver = approverFor(report.submittedBy?.department, post);
        incoming.approval = { required: true, approver, status: "pending" };
        report.status = "pending_risk_approval";
        stamp(report, user.name, "Risk acceptance requested", `${post} exceeds tolerance. Routed to ${approver}.`);
        await notify({
          to: approver,
          subject: `Risk acceptance required - ${report.safetyRef}`,
          body: `A residual risk of ${post} on ${report.formTitle} needs your acceptance.`,
          link: `${req.nextUrl.origin}/report/${report.id}`
        });
      } else {
        incoming.approval = { required: false, status: "not_required" };
      }

      report.sras[idx] = incoming;
      if (report.status === "pending_risk_approval" && !report.sras.some((sra) => sra.approval?.status === "pending")) {
        report.status = "in_progress";
      }
      stamp(report, user.name, "SRA updated", `${incoming.id}: ${incoming.title}`);
      message = `chore(sra): update ${report.id} ${incoming.id}`;
      // Saving is always allowed so work in progress is never lost; what is still missing comes
      // back with the report so the investigator can see it before closure.
      await putReport(report, `${message}\n\nActor: ${user.name} <${user.email}> staff ${user.staffNo}`, author, loaded.sha);
      return NextResponse.json({ report, problems: sraProblems(incoming) });
    }

    case "decideRisk": {
      const sra = report.sras.find((s) => s.id === body.sraId);
      if (!sra?.approval) return NextResponse.json({ error: "No risk acceptance pending" }, { status: 404 });
      if (sra.approval.approver !== user.email && user.role !== "system_admin") {
        return NextResponse.json({ error: "Only the nominated approver can decide this risk." }, { status: 403 });
      }
      sra.approval.status = body.decision === "approve" ? "approved" : "rejected";
      sra.approval.comment = body.comment;
      sra.approval.decidedAt = new Date().toISOString();
      // Other assessments on the same report may still be waiting on their own approver.
      if (!report.sras.some((s) => s.approval?.status === "pending")) report.status = "in_progress";
      stamp(report, user.name, `Risk ${sra.approval.status}`, body.comment);
      message = `feat(risk): ${sra.approval.status} ${report.id} ${sra.id}`;
      break;
    }

    /* ---------- Workflow ---------- */
    case "completeStage": {
      // Stages can now change under someone's feet (US-19), so only the stage in progress completes.
      const current = report.workflow.find((s) => s.key === body.stageKey);
      if (!current || current.status !== "in_progress") {
        return NextResponse.json({ error: "That stage is not the one in progress. Reload the report and try again." }, { status: 409 });
      }
      // US-08 criterion 15: the stage's own open tasks block it. Older tasks with no stage block every stage.
      const openTasks = (await listTasks()).filter(
        (t) => t.reportId === report.id && isTaskOpen(t.status) && (!t.stageKey || t.stageKey === body.stageKey)
      ).length;
      if (openTasks) return NextResponse.json({ error: `${openTasks} task(s) on this stage are still open. Accept them before completing the stage.` }, { status: 409 });
      report.workflow = advance(report.workflow, body.stageKey, user.email);
      const stage = report.workflow.find((s) => s.key === body.stageKey);
      if (stage && body.response) stage.response = body.response;
      stamp(report, user.name, "Stage completed", stage?.name);
      message = `chore(workflow): complete ${body.stageKey} on ${report.id}`;
      break;
    }

    /* ---------- Reopen a stage that was completed too early ---------- */
    case "reopenStage": {
      if (report.status !== "in_progress") {
        return NextResponse.json(
          { error: "Stages can be reopened only while the report is under investigation. While it is with an approver, ask them to send it back." },
          { status: 409 }
        );
      }
      const reason = String(body.reason ?? "").trim();
      if (!reason) return NextResponse.json({ error: "Say why this stage is being reopened. It goes on the Timeline." }, { status: 422 });
      const result = reopenStage(report.workflow, String(body.stageKey ?? ""));
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
      report.workflow = result.stages;
      stamp(
        report,
        user.name,
        "Stage reopened",
        `${result.reopened.name}: ${reason}${result.alsoReset.length ? ` (${result.alsoReset.join(", ")} started again)` : ""}`
      );
      message = `chore(workflow): reopen ${result.reopened.key} on ${report.id}`;
      break;
    }

    /* ---------- Hand the report to someone else (BRD 3.2) ---------- */
    case "reassign": {
      if (!can(user.role, "report.assignInvestigator")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      if (!report.triage || report.triage.decision === "reject") {
        return NextResponse.json({ error: "Only an accepted report can be reassigned." }, { status: 409 });
      }
      if (["closed", "rejected"].includes(report.status)) {
        return NextResponse.json({ error: "This report is finished. There is nothing to reassign." }, { status: 409 });
      }
      const next = assignableInvestigators(user).find((p) => p.email === body.investigator);
      if (!next) return NextResponse.json({ error: "Pick an investigator, SMS nodal or gatekeeper from the list." }, { status: 422 });
      const previous = holderOf(report);
      if (previous === next.email) return NextResponse.json({ error: `${next.name} already holds this report.` }, { status: 422 });

      report.triage.investigator = next.email;
      stamp(report, user.name, "Reassigned", `${previous ?? "unassigned"} to ${next.name}${body.comment ? `: ${body.comment}` : ""}`);
      message = `feat(triage): reassign ${report.id} to ${next.email}`;
      await notify({
        to: next.email,
        subject: `Investigation assigned - ${report.safetyRef ?? report.id}`,
        body: `${user.name} has handed you a ${report.formTitle}.${body.comment ? ` ${body.comment}` : ""}`,
        link: `${req.nextUrl.origin}/report/${report.id}`
      });
      break;
    }

    /* ---------- Add, remove and reorder stages on this report (US-19) ---------- */
    case "editStages": {
      if (!can(user.role, "workflow.editStages")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      if (report.status !== "in_progress") {
        return NextResponse.json({ error: "Stages can only be changed while the report is under investigation." }, { status: 409 });
      }
      if (!Array.isArray(body.stages)) return NextResponse.json({ error: "Send the stages to save." }, { status: 400 });
      const proposed = (body.stages as { key?: string; name?: string; taskDays?: number }[]).map((s) => ({
        key: String(s?.key ?? ""),
        name: String(s?.name ?? ""),
        taskDays: Number(s?.taskDays)
      }));
      const result = applyStageEdits(report.workflow, proposed);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
      report.workflow = result.stages;
      stamp(report, user.name, "Workflow stages changed", result.changes.join("; "));
      message = `chore(workflow): edit stages on ${report.id}`;
      break;
    }

    /* ---------- Closure and approvals (BRD 3.5, 3.6) ---------- */
    case "submitClosure": {
      if (!can(user.role, "closure.sendForApproval")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      const openTasks = (await listTasks()).filter((t) => t.reportId === report.id && t.status !== "accepted").length;
      const gate = closureReadiness(report, openTasks);
      if (!gate.ok) return NextResponse.json({ error: "Closure blocked", blockers: gate.blockers }, { status: 422 });
      if (!body.signOff?.trim()) return NextResponse.json({ error: "Investigator sign-off is required." }, { status: 422 });

      const hasPeriod = report.sras.every((s) => s.hazards.every((h) => h.controls.every((c) => c.monitoringPeriod)));
      if (!hasPeriod) return NextResponse.json({ error: "Set a monitoring period on every control before sending for approval." }, { status: 422 });

      report.closure = { submittedBy: user.name, submittedAt: new Date().toISOString(), signOff: body.signOff, followUp: body.followUp };
      report.status = "pending_gatekeeper_approval";
      stamp(report, user.name, "Submitted for closure");
      message = `feat(closure): submit ${report.id} for approval`;
      break;
    }

    case "gatekeeperDecision": {
      if (!can(user.role, "closure.gatekeeperReview")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      if (report.status !== "pending_gatekeeper_approval") return NextResponse.json({ error: "Not awaiting gatekeeper review" }, { status: 409 });
      report.closure = report.closure ?? {};
      report.closure.gatekeeper = { decision: body.decision, by: user.name, at: new Date().toISOString(), comment: body.comment };
      if (body.decision === "approved") {
        report.status = "pending_cofs_approval";
        stamp(report, user.name, "Gatekeeper approved closure");
      } else {
        report.status = "in_progress";
        if (body.reassignTo && report.triage) report.triage.investigator = body.reassignTo;
        stamp(report, user.name, "Gatekeeper rejected closure", body.comment);
      }
      message = `feat(closure): gatekeeper ${body.decision} ${report.id}`;
      break;
    }

    case "cofsDecision": {
      if (!can(user.role, "closure.approve")) return NextResponse.json({ error: "Only COFS can approve closure." }, { status: 403 });
      if (report.status !== "pending_cofs_approval") return NextResponse.json({ error: "Not awaiting COFS approval" }, { status: 409 });
      report.closure = report.closure ?? {};
      report.closure.cofs = { decision: body.decision, by: user.name, at: new Date().toISOString(), comment: body.comment };
      if (body.decision === "approved") {
        report.closure.closedAt = new Date().toISOString();
        report.workflow = advance(report.workflow, "closure", user.email);
        const monitored = report.sras.some((s) => s.hazards.some((h) => h.controls.some((c) => c.monitoringPeriod && c.monitoringPeriod !== "N/A")));
        report.status = monitored ? "effectiveness_review" : "closed";
        stamp(report, user.name, "COFS approved closure", monitored ? "Controls entered effectiveness monitoring" : "Report closed");
      } else {
        report.status = "in_progress";
        if (body.reassignTo && report.triage) report.triage.investigator = body.reassignTo;
        stamp(report, user.name, "COFS rejected closure", body.comment);
      }
      message = `feat(closure): cofs ${body.decision} ${report.id}`;
      break;
    }

    /* ---------- Effectiveness review (BRD 3.7) ---------- */
    case "effectivenessReview": {
      const control = report.sras.flatMap((s) => s.hazards).flatMap((h) => h.controls).find((c) => c.id === body.controlId);
      if (!control) return NextResponse.json({ error: "Control not found" }, { status: 404 });
      control.reviewOutcome = body.outcome;
      control.effectiveness = body.effectiveness;
      control.actionPlan = body.actionPlan;

      if (body.outcome === "Ineffective") {
        report.status = "in_progress";
        if (body.reassignTo && report.triage) report.triage.investigator = body.reassignTo;
        stamp(report, user.name, "Control ineffective - investigation reopened", control.id);
      } else if (body.outcome === "Partially Effective") {
        control.monitoringPeriod = body.extendTo;
        control.reviewDate = body.newReviewDate;
        stamp(report, user.name, "Monitoring extended", `${control.id} to ${body.extendTo}`);
      } else {
        const allDone = report.sras.flatMap((s) => s.hazards).flatMap((h) => h.controls).every((c) => c.reviewOutcome === "Effective" || c.monitoringPeriod === "N/A");
        if (allDone) report.status = "closed";
        stamp(report, user.name, "Control effective", control.id);
      }
      message = `feat(effectiveness): ${body.outcome} ${report.id} ${control.id}`;
      break;
    }

    /* ---------- Crew and aircraft, entered by hand ---------- */
    case "saveAircraftAndCrew": {
      if (!can(user.role, "workspace.access")) return NextResponse.json({ error: "Not permitted" }, { status: 403 });
      report.cae = {
        source: "manual",
        fetchedAt: new Date().toISOString(),
        aircraft: body.aircraft,
        crew: body.crew ?? []
      };
      stamp(report, user.name, "Crew and aircraft recorded", `${body.aircraft?.registration ?? "no registration"}, ${(body.crew ?? []).length} crew`);
      message = `chore(aircraft): record crew and aircraft on ${report.id}`;
      break;
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }

  await putReport(report, `${message}\n\nActor: ${user.name} <${user.email}> staff ${user.staffNo}`, author, loaded.sha);
  return NextResponse.json({ report });
}

/**
 * Safety risk assessments (BRD section 7).
 *
 * One assessment covers one hazard register entry: the risk index, the action it calls for and the
 * review of that action belong to the assessment as a whole, and hazards with their controls are
 * the repeating part inside it. Assessments saved before that split kept a risk index on each
 * hazard, so loading lifts the worst of those up to the assessment (see normaliseSra).
 *
 * Which assessments exist is not a choice: on an Investigation + SRA report there is exactly one
 * per finding flagged "needs a safety risk assessment", and on an SRA-only report exactly one.
 * syncSras keeps the list in step with the findings (US-05).
 */
import masters from "../../config/masters.json";
import { zoneOf } from "./risk";
import type { Finding, Report, Sra } from "./types";

export const SRA_STATUSES = masters.sraStatuses as string[];
export const SRA_REVIEW_PERIODS = masters.sraReviewPeriods as string[];
export const FUNCTIONAL_AREAS = masters.functionalAreas as Record<string, string[]>;
export const HAZARD_REGISTER = masters.hazardRegister as string[];
export const CONTROL_LIBRARY = masters.controlLibrary as string[];

const ZONES = ["green", "yellow", "orange", "red"];

export function blankSra(id: string, title: string, findingRef?: string): Sra {
  return {
    id,
    findingRef,
    title,
    hazards: [],
    status: "Open",
    dateAddedToRegister: new Date().toISOString().slice(0, 10),
    approval: { required: false, status: "not_required" }
  };
}

/** The originator shown on the assessment: the reporter, or "Confidential" (BRD 7 field 3). */
export function originatorOf(report: Pick<Report, "confidential" | "submittedBy">): string {
  return report.confidential ? "Confidential" : report.submittedBy?.name ?? "Unknown";
}

/** An assessment as the app works with it now, whatever shape it was saved in. */
export function normaliseSra(sra: Sra, index = 0): Sra {
  const hazards = (sra.hazards ?? []).map((h) => ({ ...h, controls: h.controls ?? [] }));
  const worst = (pick: "preMitigation" | "postMitigation") => {
    const indexes = hazards.map((h) => h[pick]).filter(Boolean) as string[];
    return indexes.sort((a, b) => ZONES.indexOf(zoneOf(b) ?? "green") - ZONES.indexOf(zoneOf(a) ?? "green"))[0];
  };
  return {
    ...sra,
    hazards,
    serial: sra.serial ?? index + 1,
    status: sra.status ?? "Open",
    preMitigation: sra.preMitigation ?? worst("preMitigation"),
    postMitigation: sra.postMitigation ?? worst("postMitigation")
  };
}

/**
 * The assessments a report should have (US-05 criteria 2 and 3).
 *
 * Investigation + SRA: one per finding flagged for assessment, in finding order. Unflagging a
 * finding or deleting it takes its assessment with it, risk data and all.
 * SRA only: exactly one assessment, which exists from the moment the report is accepted.
 * Database only: none.
 */
export function syncSras(
  decision: string | undefined,
  findings: Finding[],
  current: Sra[]
): { sras: Sra[]; removed: Sra[] } {
  if (!decision || decision === "database_only" || decision === "reject") return { sras: [], removed: current };
  if (decision === "sra_only") {
    const kept = current.length ? [current[0]] : [blankSra("SRA-1", "Safety risk assessment")];
    return { sras: kept.map((s, i) => ({ ...s, serial: i + 1 })), removed: current.slice(1) };
  }

  const wanted = findings.filter((f) => f.sraRequired);
  const sras = wanted.map((f, i) => {
    const existing = current.find((s) => s.findingRef === f.id);
    const title = f.text.trim().slice(0, 80) || `Finding ${f.id}`;
    return existing ? { ...existing, title, serial: i + 1 } : { ...blankSra(`SRA-${f.id}`, title, f.id), serial: i + 1 };
  });
  const keep = new Set(sras.map((s) => s.id));
  return { sras, removed: current.filter((s) => !keep.has(s.id)) };
}

/** What is lost by dropping an assessment, for the warning before it happens. */
export function sraContents(sra: Sra): string[] {
  const parts: string[] = [];
  if (sra.hazards.length) parts.push(`${sra.hazards.length} hazard${sra.hazards.length === 1 ? "" : "s"}`);
  const controls = sra.hazards.reduce((n, h) => n + (h.controls?.length ?? 0), 0);
  if (controls) parts.push(`${controls} control${controls === 1 ? "" : "s"}`);
  if (sra.preMitigation || sra.postMitigation) parts.push("its risk rating");
  if (sra.approval?.status === "approved") parts.push("an accepted risk");
  return parts;
}

/**
 * BRD 7 field 22: the review date is the last business day of the chosen review period, counted
 * from the day the action was closed. "After the Flight" and "N/A" have no date.
 */
export function reviewDateFor(period: string | undefined, from = new Date()): string | undefined {
  const months: Record<string, number> = { "3 Months": 3, "6 Months": 6, "12 Months": 12 };
  const add = months[period ?? ""];
  if (!add) return undefined;
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + add + 1, 0));
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Everything wrong with an assessment as submitted, in the order an investigator would fix it. */
export function sraProblems(sra: Sra): string[] {
  const errors: string[] = [];
  if (!sra.source?.trim()) errors.push("Say where the assessment came from in Source.");
  if (!sra.location?.trim()) errors.push("Give the location (ICAO designator).");
  if (!sra.functionalArea) errors.push("Choose the functional area.");
  if (sra.functionalArea && FUNCTIONAL_AREAS[sra.functionalArea]?.length && !sra.subFunction) {
    errors.push("Choose the sub-function.");
  }
  sra.hazards.forEach((h, i) => {
    const name = h.hazard?.trim() || `Hazard ${i + 1}`;
    if (!h.hazard?.trim()) errors.push(`Hazard ${i + 1} needs a hazard from the register, or a new one.`);
    if (!h.rootCause?.trim()) errors.push(`"${name}" needs a root cause.`);
    if (!h.resultantRisk?.trim()) errors.push(`"${name}" needs the resultant risk of the hazard.`);
    if (!h.worstCredibleEffect?.trim()) errors.push(`"${name}" needs the worst credible effect.`);
    if (!(h.controls ?? []).some((c) => c.kind === "existing" && c.text.trim())) {
      errors.push(`"${name}" needs at least one existing control.`);
    }
    if (!(h.controls ?? []).some((c) => c.kind === "additional" && c.text.trim())) {
      errors.push(`"${name}" needs at least one additional control - the risk mitigation strategy.`);
    }
  });
  if (sra.status === "Closed") {
    if (!sra.reviewPeriod) errors.push("Choose a review period before closing the action.");
    if (!sra.effectiveness?.trim()) errors.push("Record how effective the controls were before closing the action.");
  }
  return errors;
}

/** What still blocks closure of the report (BRD 3.5), per assessment. */
export function sraClosureBlockers(sra: Sra): string[] {
  const blockers: string[] = [];
  const name = sra.title || sra.id;
  if (!sra.hazards.length) blockers.push(`SRA "${name}" has no hazards`);
  if (!sra.preMitigation || !sra.postMitigation) blockers.push(`SRA "${name}" is missing a pre- or post-mitigation risk rating`);
  if (!sra.action?.trim()) blockers.push(`SRA "${name}" has no action recorded`);
  if (!sra.owner?.trim()) blockers.push(`SRA "${name}" has no owner`);
  if (!sra.deadline) blockers.push(`SRA "${name}" has no deadline`);
  if (sra.approval?.status === "pending") blockers.push(`SRA "${name}" is awaiting risk acceptance by ${sra.approval.approver}`);
  if (sra.approval?.status === "rejected") blockers.push(`SRA "${name}" was rejected - strengthen the controls and resubmit`);
  return blockers;
}

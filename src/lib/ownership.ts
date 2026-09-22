/**
 * Who holds a report.
 *
 * Triage hands a report to one investigator or SMS nodal, and from that moment the work is
 * theirs: the investigation, the risk assessment, the stages, the tasks and the request for
 * closure. The gatekeeper who assigned it keeps triage, reassignment and the closure review, but
 * stops being the one who fills it in - which is what "assigned" has to mean for a queue to be
 * worth anything.
 *
 * Admin and System Admin can always step in, so a report is never stuck behind one person.
 */
import type { Report, Role } from "./types";

export interface Actor {
  email: string;
  role: Role;
}

/** The person the report is assigned to, if it has been accepted. */
export function holderOf(report: Pick<Report, "triage">): string | undefined {
  const triage = report.triage;
  if (!triage || triage.decision === "reject") return undefined;
  return triage.investigator;
}

/** Can this person do the work on the report - not just read it? */
export function canWorkOn(user: Actor, report: Pick<Report, "triage">): boolean {
  const holder = holderOf(report);
  // Nobody holds it yet (untriaged, or filed before assignment was recorded): role rules decide.
  if (!holder) return true;
  if (holder === user.email) return true;
  return user.role === "admin" || user.role === "system_admin";
}

/** Why the work is closed to this person, for the message they see. Null when it is not. */
export function workBlockedReason(user: Actor, report: Pick<Report, "triage">, holderName?: string): string | null {
  if (canWorkOn(user, report)) return null;
  return `This report is assigned to ${holderName ?? holderOf(report)}. They carry out the investigation; you can read everything here.`;
}

import matrix from "../../config/rbac-matrix.json";
import type { Role } from "./types";

export type Permission = keyof typeof matrix.permissions;

export function can(role: Role | undefined, permission: Permission): boolean {
  if (!role) return false;
  const allowed = (matrix.permissions as Record<string, string[]>)[permission];
  return Array.isArray(allowed) && allowed.includes(role);
}

export function roleLabel(role: Role): string {
  return (matrix.labels as Record<string, string>)[role] ?? role;
}

export const ROLES = matrix.roles as Role[];

/**
 * Report-level visibility (BRD 3.3 / feature 6):
 *  - Admin, COFS, System Admin see everything.
 *  - Assigned investigator sees their report.
 *  - SMS Nodal investigators see their own department only (NOT all reports).
 *  - Gatekeepers see reports in their group.
 *  - Reporter sees their own report.
 */
export function canSeeReport(
  user: { email: string; role: Role; department: string; groups: string[]; scope: "all" | "department" },
  report: { investigator?: string; gatekeeperGroup: string; department?: string; raisedByEmail?: string }
): boolean {
  // Admin roles see everything
  if (user.role === "system_admin" || user.role === "cofs" || user.role === "admin") return true;

  // Assigned investigator sees this report
  if (report.investigator === user.email) return true;

  // Gatekeeper group members see reports in their queue
  if (user.groups.includes(report.gatekeeperGroup)) return true;

  // SMS Nodals (scope: "department") ONLY see reports from their department
  if (user.role === "investigator" && user.scope === "department" && report.department === user.department) return true;

  // Reporter sees their own report
  return report.raisedByEmail === user.email;
}

/**
 * Report edit permission:
 *  - Only the assigned investigator OR admin can edit a submitted report.
 *  - Other investigators cannot edit reports not assigned to them.
 */
export function canEditReport(
  user: { email: string; role: Role },
  report: { investigator?: string; status: string }
): boolean {
  // Admin roles can edit any report
  if (user.role === "system_admin" || user.role === "admin") return true;

  // Only assigned investigator can edit this report
  if (report.investigator === user.email) return true;

  return false;
}

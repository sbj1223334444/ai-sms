import cfg from "../../config/risk-matrix.json";

export type Zone = "red" | "orange" | "yellow" | "green";
const ORDER: Zone[] = ["green", "yellow", "orange", "red"];

export const severities = cfg.severity;
export const probabilities = cfg.probability;

export function zoneOf(index: string): Zone | null {
  return ((cfg.cells as Record<string, string>)[index] as Zone) ?? null;
}

export function zoneInfo(zone: Zone) {
  return (cfg.zones as Record<string, { label: string; tolerability: string; authority: string }>)[zone];
}

export function split(index: string) {
  return { probability: index.slice(0, 1), severity: index.slice(1, 2) };
}

function sevRank(code: string) {
  return cfg.severity.findIndex((s) => s.code === code);
}
function probRank(code: string) {
  return cfg.probability.findIndex((p) => p.code === code);
}

export interface MitigationCheck {
  ok: boolean;
  blocked?: string;
  warn?: string;
}

/**
 * BRD section 7 rules.
 *  1. Post severity cannot be worse than pre. Making it better is allowed but warns.
 *  2. Post probability can only be reduced, never increased.
 *  3. Post total risk index cannot exceed pre.
 */
export function checkMitigation(pre: string, post: string): MitigationCheck {
  const a = split(pre);
  const b = split(post);

  if (sevRank(b.severity) < sevRank(a.severity)) {
    return { ok: false, blocked: "Post-mitigation severity cannot be higher than pre-mitigation severity." };
  }
  if (probRank(b.probability) < probRank(a.probability)) {
    return { ok: false, blocked: "Post-mitigation probability can only be reduced, never increased." };
  }
  const preZone = zoneOf(pre);
  const postZone = zoneOf(post);
  if (preZone && postZone && ORDER.indexOf(postZone) > ORDER.indexOf(preZone)) {
    return { ok: false, blocked: "Post-mitigation risk index cannot exceed the pre-mitigation index." };
  }
  if (sevRank(b.severity) > sevRank(a.severity)) {
    return {
      ok: true,
      warn:
        "You are lowering the severity of this risk. Severity rarely changes through mitigation - controls usually reduce probability. Confirm only if the worst credible outcome itself has genuinely changed."
    };
  }
  return { ok: true };
}

/** Does this residual risk exceed the user's tolerance and need routing to an approver? */
export function needsApproval(postIndex: string, role: string): boolean {
  const zone = zoneOf(postIndex);
  const tolerance = (cfg.defaultTolerance as Record<string, Zone>)[role] ?? "green";
  if (!zone) return false;
  return ORDER.indexOf(zone) > ORDER.indexOf(tolerance);
}

export function approverFor(department: string | undefined, postIndex: string): string {
  const zone = zoneOf(postIndex);
  if (zone === "red") return cfg.departmentApprovers["Flight Operations"];
  return (cfg.departmentApprovers as Record<string, string>)[department ?? ""] ?? cfg.departmentApprovers["Flight Operations"];
}

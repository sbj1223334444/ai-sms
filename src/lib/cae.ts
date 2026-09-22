import type { CaeData } from "./types";

/**
 * CAE Crew Management / Movement Manager — NOT WIRED UP.
 *
 * There is no CAE access on this build, so nothing calls out to it: the investigator types crew
 * and aircraft details into the workspace instead, and each value records that it came from a
 * person rather than a system. The shape of CaeData is unchanged, so turning the integration on
 * later is a matter of filling in this function and calling it from the triage handler.
 *
 * When you do get CAE credentials, the BRD rules that still apply are: fetch only after the report
 * is submitted, never while the reporter is typing; never block the report when the API fails;
 * and keep the manual override path below as the fallback.
 */
export function caeEnabled(): boolean {
  return Boolean(process.env.CAE_API_URL && process.env.CAE_API_TOKEN);
}

export async function fetchCae(_flightNo?: string, _flightDate?: string): Promise<CaeData> {
  return {
    source: "manual",
    error: "CAE is not connected on this deployment. Enter crew and aircraft details by hand."
  };
}

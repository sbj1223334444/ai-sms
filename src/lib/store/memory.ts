/**
 * In-memory datastore. Used automatically when no GitHub credentials are set, so the app works
 * the moment it boots with nothing configured.
 *
 * Data lives in the running process: it survives page navigation but not a restart, and on
 * Vercel each serverless instance holds its own copy. Fine for a demo or a stakeholder walkthrough,
 * not for anything you need to keep. Set GITHUB_TOKEN to switch to the durable driver.
 */
import { seedReports } from "./seed-data";

// Kept on globalThis because Next.js can load this module more than once in one process (one
// copy per route bundle, plus hot reloads). Module-level variables would give each route its own
// store, so a form saved by the admin API would be invisible to the report API.
const shared = globalThis as typeof globalThis & {
  __aiSmsMemoryStore?: {
    files: Map<string, unknown>;
    log: { path: string; message: string; author: string; email: string; at: string }[];
    seeded: boolean;
  };
};
shared.__aiSmsMemoryStore ??= { files: new Map(), log: [], seeded: false };
const store = shared.__aiSmsMemoryStore;
const { files, log } = store;

function ensureSeed() {
  if (store.seeded) return;
  store.seeded = true;
  files.set("data/index.json", []);
  files.set("data/task-index.json", []);
  files.set("data/counters.json", { report: 0, safetyRef: 0, task: 0, hazard: 0, control: 0 });
  for (const r of seedReports()) {
    files.set(`data/reports/${r.id}.json`, r);
    (files.get("data/index.json") as unknown[]).push(r.indexRow);
  }
  files.set("data/counters.json", { report: seedReports().length, safetyRef: 1, task: 0, hazard: 1, control: 1 });
}

export function storeConfigured() {
  return true;
}

export async function readJson<T>(path: string): Promise<{ data: T; sha: string } | null> {
  ensureSeed();
  if (!files.has(path)) return null;
  return { data: JSON.parse(JSON.stringify(files.get(path))) as T, sha: "memory" };
}

export async function writeJson<T>(
  path: string,
  data: T,
  message: string,
  actor: { name: string; email: string }
): Promise<string> {
  ensureSeed();
  files.set(path, JSON.parse(JSON.stringify(data)));
  log.unshift({ path, message, author: actor.name, email: actor.email, at: new Date().toISOString() });
  return "memory";
}

export async function mutate<T>(
  path: string,
  fallback: T,
  update: (current: T) => T,
  message: string,
  actor: { name: string; email: string }
): Promise<T> {
  const loaded = await readJson<T>(path);
  const next = update(loaded ? loaded.data : fallback);
  await writeJson(path, next, message, actor);
  return next;
}

export async function history(path: string, limit = 100) {
  return log.filter((l) => l.path === path).slice(0, limit).map((l) => ({ sha: "memory", ...l }));
}

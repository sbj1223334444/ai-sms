/**
 * Redis as the datastore, through the Upstash REST API (plain fetch, no client library).
 *
 * Why it exists: on Vercel, pages and API routes run as separate serverless functions, so the
 * in-memory store gives each of them its own copy. A triage saved by the API was never seen by the
 * report page. Every function reads and writes the same Redis, so they all agree.
 *
 * Connect it from the Vercel project's Storage tab (Upstash for Redis). Vercel then sets
 * KV_REST_API_URL and KV_REST_API_TOKEN (or UPSTASH_REDIS_REST_URL / _TOKEN) and this driver is used.
 *
 * Layout: each file is one key holding its JSON; each file's change log is a capped list, newest
 * first. The demo reports are written once, on first use, exactly as the in-memory store has them.
 */
import { seedReports } from "./seed-data";

const url = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || "").replace(/\/$/, "");
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || "";
const NS = "ai-sms";
const fileKey = (path: string) => `${NS}:file:${path}`;
const logKey = (path: string) => `${NS}:log:${path}`;
const lockKey = (path: string) => `${NS}:lock:${path}`;
const LOG_LIMIT = 200;

type Cmd = (string | number)[];

async function call<T = unknown>(cmd: Cmd): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
    cache: "no-store"
  });
  const body = (await res.json()) as { result?: T; error?: string };
  if (!res.ok || body.error) throw new Error(`Redis ${cmd[0]} failed: ${body.error ?? res.status}`);
  return body.result as T;
}

async function pipeline(cmds: Cmd[]): Promise<unknown[]> {
  if (!cmds.length) return [];
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds),
    cache: "no-store"
  });
  const body = (await res.json()) as { result?: unknown; error?: string }[];
  if (!res.ok) throw new Error(`Redis pipeline failed: ${res.status}`);
  const failed = body.find((r) => r.error);
  if (failed) throw new Error(`Redis pipeline failed: ${failed.error}`);
  return body.map((r) => r.result);
}

export function storeConfigured(): boolean {
  return Boolean(url && token);
}

/* ---------------- One-time demo seed ---------------- */

let seeding: Promise<void> | null = null;

function ensureSeed(): Promise<void> {
  if (!seeding) {
    seeding = (async () => {
      // SET NX: exactly one caller, across every function and instance, writes the seed.
      const first = await call<string | null>(["SET", `${NS}:seeded`, new Date().toISOString(), "NX"]);
      if (first !== "OK") return;
      const reports = seedReports();
      const index = reports.map((r) => r.indexRow);
      await pipeline([
        ...reports.map(({ indexRow: _row, ...r }) => ["SET", fileKey(`data/reports/${r.id}.json`), JSON.stringify(r)] as Cmd),
        ["SET", fileKey("data/index.json"), JSON.stringify(index)],
        ["SET", fileKey("data/task-index.json"), JSON.stringify([])],
        ["SET", fileKey("data/counters.json"), JSON.stringify({ report: reports.length, safetyRef: 1, task: 0, hazard: 1, control: 1 })]
      ]);
    })().catch((err) => {
      seeding = null;
      throw err;
    });
  }
  return seeding;
}

/* ---------------- Driver interface (same as memory.ts and github.ts) ---------------- */

export async function readJson<T>(path: string): Promise<{ data: T; sha: string } | null> {
  await ensureSeed();
  const raw = await call<string | null>(["GET", fileKey(path)]);
  if (raw === null || raw === undefined) return null;
  return { data: JSON.parse(raw) as T, sha: "redis" };
}

export async function writeJson<T>(
  path: string,
  data: T,
  message: string,
  actor: { name: string; email: string }
): Promise<string> {
  await ensureSeed();
  const entry = JSON.stringify({ path, message, author: actor.name, email: actor.email, at: new Date().toISOString() });
  await pipeline([
    ["SET", fileKey(path), JSON.stringify(data)],
    ["LPUSH", logKey(path), entry],
    ["LTRIM", logKey(path), 0, LOG_LIMIT - 1]
  ]);
  return "redis";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Read-modify-write under a short lock, so two saves at once cannot lose an update: counters stay
 * unique and the queue index keeps every report.
 */
export async function mutate<T>(
  path: string,
  fallback: T,
  update: (current: T) => T,
  message: string,
  actor: { name: string; email: string }
): Promise<T> {
  await ensureSeed();
  const owner = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  for (let attempt = 0; attempt < 60; attempt++) {
    const got = await call<string | null>(["SET", lockKey(path), owner, "NX", "PX", 5000]);
    if (got === "OK") break;
    if (attempt === 59) throw new Error(`${path} is busy. Try again in a moment.`);
    await sleep(50 + Math.random() * 100);
  }
  try {
    const loaded = await readJson<T>(path);
    const next = update(loaded ? loaded.data : fallback);
    await writeJson(path, next, message, actor);
    return next;
  } finally {
    // Release only our own lock; an expired one may already belong to someone else.
    const holder = await call<string | null>(["GET", lockKey(path)]).catch(() => null);
    if (holder === owner) await call(["DEL", lockKey(path)]).catch(() => undefined);
  }
}

export async function history(path: string, limit = 100) {
  const rows = await call<string[]>(["LRANGE", logKey(path), 0, Math.max(0, limit - 1)]);
  return rows.map((r) => ({ sha: "redis", ...(JSON.parse(r) as { path: string; message: string; author: string; email: string; at: string }) }));
}

import { Octokit } from "@octokit/rest";

/**
 * GitHub as the datastore.
 *
 * Every write is a commit, so `git log` is the audit trail: author, action, timestamp and a
 * full before/after diff, append-only and signed by GitHub. That covers the BRD's tamper-proof
 * logging requirement without a separate audit table.
 *
 * Constraints to design around, documented in docs/ARCHITECTURE.md:
 *  - 5,000 REST calls/hour on a PAT. Cache reads, batch writes.
 *  - No transactions. Writes use SHA-based optimistic locking and fail loudly on conflict.
 *  - No query engine. The queue reads an index file, not every report.
 *  - Files are not encrypted at rest beyond GitHub's own. Keep the repo private, and keep
 *    confidential-report identities out of the report file entirely (see submitReport).
 */

const owner = process.env.GITHUB_OWNER || "";
const repo = process.env.GITHUB_DATA_REPO || "";
const branch = process.env.GITHUB_BRANCH || "main";

let client: Octokit | null = null;
function gh(): Octokit {
  if (!client) client = new Octokit({ auth: process.env.GITHUB_TOKEN });
  return client;
}

export function storeConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN && owner && repo);
}

export class ConflictError extends Error {
  constructor(public path: string) {
    super(`${path} changed since it was read. Reload and reapply the change.`);
  }
}

export interface Loaded<T> {
  data: T;
  sha: string;
}

export async function readJson<T>(path: string): Promise<Loaded<T> | null> {
  try {
    const res = await gh().repos.getContent({ owner, repo, path, ref: branch });
    const file = res.data as { content?: string; sha: string; type: string };
    if (file.type !== "file" || !file.content) return null;
    return { data: JSON.parse(Buffer.from(file.content, "base64").toString("utf8")) as T, sha: file.sha };
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return null;
    throw err;
  }
}

export async function writeJson<T>(
  path: string,
  data: T,
  message: string,
  actor: { name: string; email: string },
  sha?: string
): Promise<string> {
  try {
    const res = await gh().repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      branch,
      message,
      content: Buffer.from(JSON.stringify(data, null, 2), "utf8").toString("base64"),
      sha,
      author: { name: actor.name, email: actor.email },
      committer: { name: actor.name, email: actor.email }
    });
    return res.data.content?.sha as string;
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 409) throw new ConflictError(path);
    throw err;
  }
}

/** Read-modify-write with one retry on conflict. */
export async function mutate<T>(
  path: string,
  fallback: T,
  update: (current: T) => T,
  message: string,
  actor: { name: string; email: string }
): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const loaded = await readJson<T>(path);
    const next = update(loaded ? loaded.data : fallback);
    try {
      await writeJson(path, next, message, actor, loaded?.sha);
      return next;
    } catch (err) {
      if (err instanceof ConflictError && attempt < 2) continue;
      throw err;
    }
  }
  throw new ConflictError(path);
}

export async function history(path: string, limit = 100) {
  const res = await gh().repos.listCommits({ owner, repo, path, sha: branch, per_page: limit });
  return res.data.map((c) => ({
    sha: c.sha,
    message: c.commit.message,
    author: c.commit.author?.name || "unknown",
    email: c.commit.author?.email || "",
    at: c.commit.author?.date || ""
  }));
}

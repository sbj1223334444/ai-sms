#!/usr/bin/env node
/**
 * Creates the skeleton of the data repository. Run once after setting the GitHub env vars.
 *   npm run seed
 */
import { Octokit } from "@octokit/rest";

const { GITHUB_TOKEN, GITHUB_OWNER, GITHUB_DATA_REPO, GITHUB_BRANCH = "main" } = process.env;

if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_DATA_REPO) {
  console.error("Set GITHUB_TOKEN, GITHUB_OWNER and GITHUB_DATA_REPO first.");
  process.exit(1);
}

const gh = new Octokit({ auth: GITHUB_TOKEN });

const files = [
  ["data/index.json", []],
  ["data/task-index.json", []],
  ["data/counters.json", { report: 0, safetyRef: 0, task: 0, hazard: 0, control: 0 }],
  ["data/reports/.gitkeep", ""],
  ["data/tasks/.gitkeep", ""]
];

const README = `# Contrail data

Operational data for the Contrail safety management system. Written only by the Contrail
application through the GitHub API.

Every commit here is an audit record: the author is the person who took the action, the message
says what they did, and the diff shows exactly what changed. Do not commit to this repository by
hand, and do not rewrite history - that is what makes the log trustworthy.

Keep this repository private.
`;

for (const [path, content] of files) {
  const body = typeof content === "string" ? content : JSON.stringify(content, null, 2);
  try {
    await gh.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_DATA_REPO,
      path,
      branch: GITHUB_BRANCH,
      message: `chore(seed): create ${path}`,
      content: Buffer.from(body, "utf8").toString("base64")
    });
    console.log("created", path);
  } catch (err) {
    if (err.status === 422) console.log("exists ", path);
    else throw err;
  }
}

await gh.repos
  .createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_DATA_REPO,
    path: "README.md",
    branch: GITHUB_BRANCH,
    message: "docs: explain the data repository",
    content: Buffer.from(README, "utf8").toString("base64")
  })
  .catch(() => console.log("exists  README.md"));

console.log("\nData repository ready.");

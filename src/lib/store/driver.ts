import * as github from "./github";
import * as redis from "./redis";
import * as memory from "./memory";

/**
 * Pick the datastore:
 *  - GitHub when GITHUB_TOKEN, GITHUB_OWNER and GITHUB_DATA_REPO are set (every write is a commit);
 *  - otherwise Redis when a Vercel / Upstash Redis store is connected (KV_REST_API_URL + TOKEN);
 *  - otherwise in-memory, so the app works with nothing configured. In memory, each serverless
 *    function holds its own copy, so on Vercel pages and APIs can disagree. Use Redis there.
 */
const useGithub = Boolean(process.env.GITHUB_TOKEN && process.env.GITHUB_OWNER && process.env.GITHUB_DATA_REPO);
const useRedis = !useGithub && redis.storeConfigured();

export const driver = useGithub ? github : useRedis ? redis : memory;
export const driverName = useGithub ? "github" : useRedis ? "redis" : "memory";
export const isDurable = useGithub || useRedis;
export const { readJson, writeJson, mutate, history } = driver;
export { ConflictError } from "./github";

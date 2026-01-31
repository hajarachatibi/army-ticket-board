import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function isTruthyEnv(value: string | undefined) {
  if (!value) return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

let redisSingleton: Redis | null = null;
function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  if (!redisSingleton) {
    redisSingleton = new Redis({ url, token });
  }
  return redisSingleton;
}

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };

/**
 * Edge-safe rate limit.
 * Set ENABLE_SIGNIN_RATE_LIMIT=1 and Upstash env vars to enable.
 */
export async function rateLimitSigninByIp(ip: string): Promise<RateLimitResult> {
  if (!isTruthyEnv(process.env.ENABLE_SIGNIN_RATE_LIMIT)) return { ok: true };
  const redis = getRedis();
  if (!redis) return { ok: true };

  const max = envInt("SIGNIN_RL_IP_MAX", 15);
  const windowSeconds = envInt("SIGNIN_RL_IP_WINDOW_SECONDS", 600);

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
    analytics: false,
    prefix: "rl:signin:ip",
  });

  const key = ip && ip !== "unknown" ? ip : "unknown";
  const res = await ratelimit.limit(key);
  if (res.success) return { ok: true };
  const retryAfterSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  return { ok: false, retryAfterSeconds };
}

export async function rateLimitSigninByAccount(accountKey: string): Promise<RateLimitResult> {
  if (!isTruthyEnv(process.env.ENABLE_SIGNIN_RATE_LIMIT)) return { ok: true };
  const redis = getRedis();
  if (!redis) return { ok: true };

  const max = envInt("SIGNIN_RL_ACCOUNT_MAX", 8);
  const windowSeconds = envInt("SIGNIN_RL_ACCOUNT_WINDOW_SECONDS", 900);

  const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${windowSeconds} s`),
    analytics: false,
    prefix: "rl:signin:acct",
  });

  const key = accountKey && accountKey.length > 0 ? accountKey : "unknown";
  const res = await ratelimit.limit(key);
  if (res.success) return { ok: true };
  const retryAfterSeconds = Math.max(1, Math.ceil((res.reset - Date.now()) / 1000));
  return { ok: false, retryAfterSeconds };
}


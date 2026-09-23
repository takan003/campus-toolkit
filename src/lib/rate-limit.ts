import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getClientIp } from "@/lib/audit";

/**
 * 進程內 sliding-window rate limiter。
 * 注意：serverless 冷卻會重置計數，屬簡易防護；若需跨實例請改用 Upstash 等外部方案。
 */

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10000;

function prune(bucket: Bucket, now: number, windowMs: number): void {
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
}

function pruneAll(now: number): void {
  if (buckets.size < MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    if (bucket.hits.length === 0) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    buckets.clear();
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  pruneAll(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, now, windowMs);

  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    const retryAfterMs = windowMs - (now - oldest);
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  bucket.hits.push(now);
  return {
    ok: true,
    remaining: limit - bucket.hits.length,
    retryAfterSec: 0,
  };
}

export function clientKey(request: NextRequest, suffix = ""): string {
  const ip = getClientIp(request) || "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}

export function tooManyRequests(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { success: false, message: "請求過於頻繁，請稍後再試" },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSec) },
    }
  );
}

export function enforceRateLimit(
  request: NextRequest,
  bucketName: string,
  limit: number,
  windowMs: number,
  suffix = ""
): NextResponse | null {
  const result = checkRateLimit(
    `${bucketName}:${clientKey(request, suffix)}`,
    limit,
    windowMs
  );
  if (!result.ok) return tooManyRequests(result.retryAfterSec);
  return null;
}

export const RATE = {
  LOGIN: { limit: 10, windowMs: 60_000 },
  GOOGLE: { limit: 10, windowMs: 60_000 },
  CHANGE_PASSWORD: { limit: 10, windowMs: 60_000 },
  ADMIN_CREATE: { limit: 5, windowMs: 60 * 60_000 },
  SEED_ROLES: { limit: 5, windowMs: 60 * 60_000 },
  LEADERBOARD_POST: { limit: 20, windowMs: 60_000 },
} as const;

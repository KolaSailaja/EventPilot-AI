import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

let lastPruneAt = 0;

export async function rateLimit(key: string, limit = 5, windowMs = 60_000) {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(windowMs) || windowMs < 1) {
    throw new RangeError("Rate-limit settings must be positive integers.");
  }

  const nowMs = Date.now();
  const now = new Date(nowMs);
  const windowEndsAt = new Date(nowMs + windowMs);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  const hashedKey = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const [bucket] = await prisma.$queryRaw<Array<{ attempts: number }>>(Prisma.sql`
    INSERT INTO "RateLimitBucket" ("key", "attempts", "windowEndsAt", "updatedAt")
    VALUES (${hashedKey}, 1, ${windowEndsAt}, ${now})
    ON CONFLICT("key") DO UPDATE SET
      "attempts" = CASE
        WHEN CAST(strftime('%s', "RateLimitBucket"."windowEndsAt") AS INTEGER) * 1000 <= ${nowMs} THEN 1
        ELSE "RateLimitBucket"."attempts" + 1
      END,
      "windowEndsAt" = CASE
        WHEN CAST(strftime('%s', "RateLimitBucket"."windowEndsAt") AS INTEGER) * 1000 <= ${nowMs} THEN ${windowEndsAt}
        ELSE "RateLimitBucket"."windowEndsAt"
      END,
      "updatedAt" = ${now}
    RETURNING "attempts"
  `);

  if (nowMs - lastPruneAt > 60 * 60 * 1000) {
    lastPruneAt = nowMs;
    await prisma.rateLimitBucket.deleteMany({
      where: { windowEndsAt: { lt: new Date(nowMs - 24 * 60 * 60 * 1000) } },
    });
  }

  return {
    allowed: bucket.attempts <= limit,
    remaining: Math.max(0, limit - bucket.attempts),
  };
}

import { compare } from "bcryptjs";
import { z } from "zod";

import { rateLimit } from "@/lib/rate-limit";
import prisma from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
});

export async function authorizeCredentials(
  credentials: unknown,
  request: Pick<Request, "headers">,
) {
  const parsed = credentialsSchema.safeParse(credentials);
  if (!parsed.success || Buffer.byteLength(parsed.data?.password ?? "", "utf8") > 72) {
    return null;
  }

  const email = parsed.data.email.trim().toLowerCase();
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unavailable";
  const [emailLimit, ipLimit] = await Promise.all([
    rateLimit(`login-email:${email}`, 10, 15 * 60_000),
    rateLimit(`login-ip:${ip}`, 30, 15 * 60_000),
  ]);

  if (!emailLimit.allowed || !ipLimit.allowed) {
    return null;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    return null;
  }

  if (!(await compare(parsed.data.password, user.passwordHash))) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? user.email.split("@")[0],
  };
}

import { NextResponse } from "next/server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { BudgetProviderError, generateBudgetWithAI } from "@/lib/ai-budget-provider";
import { budgetProfileSchema } from "@/lib/budget-schema";
import { rateLimit } from "@/lib/rate-limit";

const maxRequestBytes = 8 * 1024;

async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Request body is required.");

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxRequestBytes) {
      await reader.cancel();
      throw new RangeError("Request body is too large.");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(body));
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).origin !== new URL(request.url).origin) {
        return NextResponse.json({ error: "Cross-origin requests are not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
    }
  }

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sign in to generate a budget." }, { status: 401 });

  let body: unknown;
  try {
    body = await readBoundedJson(request);
  } catch (error) {
    const tooLarge = error instanceof RangeError;
    return NextResponse.json(
      { error: tooLarge ? "The request is too large." : "Enter valid event details and try again." },
      { status: tooLarge ? 413 : 400 },
    );
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Enter valid event details and try again." }, { status: 400 });
  }

  const requestData = body as Record<string, unknown>;
  let profileInput: unknown = requestData;
  if (typeof requestData.eventId === "string") {
    const event = await prisma.event.findUnique({
      where: { id: requestData.eventId },
    });
    if (!event || event.userId !== userId) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    profileInput = {
      eventType: event.type,
      location: event.location ?? "",
      guestCount: event.guestCount,
      budget: event.budget,
      currency: event.currency,
      date: event.date?.toISOString().slice(0, 10) ?? "",
      priorities: requestData.priorities ?? "",
    };
  }

  const profile = budgetProfileSchema.safeParse(profileInput);
  if (!profile.success) {
    return NextResponse.json({ error: profile.error.issues[0]?.message ?? "Enter valid event details." }, { status: 400 });
  }

  const limit = await rateLimit(`budget-ai:${userId}`, 5, 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "You have made several budget requests. Wait a minute and try again." }, { status: 429 });
  }

  try {
    const draft = await generateBudgetWithAI(profile.data);
    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof BudgetProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("AI budget generation failed.", error);
    return NextResponse.json({ error: "Budget generation failed. Please try again." }, { status: 500 });
  }
}

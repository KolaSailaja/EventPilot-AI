import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { calculateBudgetSummary } from "@/lib/budget";
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
      include: {
        categories: { orderBy: { name: "asc" } },
        expenses: true,
        tasks: { orderBy: { dueDate: "asc" }, take: 8 },
        guests: { include: { rsvp: true } },
        vendors: { include: { quotations: true } },
      },
    });
    if (!event || event.userId !== userId) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }
    const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);
    const rsvpCounts = event.guests.reduce<Record<string, number>>((counts, guest) => {
      const status = guest.rsvp?.status ?? "pending";
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    }, {});
    const existingQuotes = event.vendors.flatMap((vendor) => vendor.quotations)
      .map((quote) => `${quote.currency} ${quote.amount}${quote.isConfirmed ? " confirmed" : " estimate"}`);
    const context = [
      `Event: ${event.name}`,
      `Theme: ${event.theme || "not specified"}; style: ${event.style || "not specified"}.`,
      `Description: ${event.description || "not provided"}`,
      `Planning notes: ${event.notes || "none"}`,
      `Constraints: ${event.constraints || "none specified"}`,
      `Existing category allocations: ${event.categories.map((category) => `${category.name} ${event.currency} ${category.allocation}`).join("; ") || "none"}`,
      `Recorded spend: ${event.currency} ${budgetSummary.actual} actual and ${event.currency} ${budgetSummary.planned} planned.`,
      `Guest RSVP counts: ${Object.entries(rsvpCounts).map(([status, count]) => `${status} ${count}`).join(", ") || "no guests recorded"}`,
      `Existing tasks: ${event.tasks.map((task) => `${task.title} (${task.status}${task.dueDate ? `, due ${task.dueDate.toISOString().slice(0, 10)}` : ""})`).join("; ") || "none"}`,
      `Recorded vendor quote amounts by quote currency: ${existingQuotes.join("; ") || "none"}`,
    ].join("\n").slice(0, 4_000);
    profileInput = {
      eventType: event.type,
      location: event.location ?? "",
      guestCount: event.guestCount,
      budget: event.budget,
      currency: event.currency,
      context,
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

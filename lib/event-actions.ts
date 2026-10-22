"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { toSafeMoney } from "@/lib/budget";
import prisma from "@/lib/prisma";
import {
  eventFormSchema,
  expenseSchema,
  guestSchema,
  planConceptSchema,
  reviewNoteSchema,
  taskSchema,
  taskStatusSchema,
  vendorSchema,
} from "@/lib/validators";

async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    redirect("/sign-in");
  }

  return {
    id: userId,
    email: session?.user?.email ?? "",
    name: session?.user?.name ?? "",
  };
}

async function requireAuthorizedEvent(eventId: string) {
  const user = await requireUser();
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, userId: true },
  });

  if (!event || event.userId !== user.id) {
    throw new Error("You are not authorized to edit this event.");
  }

  return { user, event };
}

function normalizeConceptValue(value: FormDataEntryValue | null | undefined, fallback: string) {
  const raw = typeof value === "string" ? value.trim() : "";
  return raw || fallback;
}

function buildVisionPlanContent(event: { name: string; type: string; currency: string; budget: number; guestCount: number; theme?: string | null; style?: string | null; constraints?: string | null; }, concept: {
  mood: string;
  palette: string;
  lighting: string;
  activities: string;
  menu: string;
  accessibility: string;
  schedule: string;
  constraints: string;
  budgetStrategy: string;
  tradeOffs: string;
}) {
  return [
    `Theme and visual direction\n- ${concept.mood || event.theme || event.style || `${event.type} styling`}. Keep the overall tone elevated and practical, with a polished editorial feel that still reads as a real event plan.`,
    `Color palette\n- ${concept.palette || "Warm ivory + forest green + brushed gold"}. This keeps the plan premium and versatile across hospitality, décor, staging, and signage.`,
    `Decoration and lighting ideas\n- ${concept.lighting || "Layer ambient lighting with statement focal points, using greenery and candles or warm uplighting to deepen the atmosphere without overloading the room."}`,
    `Activities and entertainment\n- ${concept.activities || "Design a clear flow of arrival, guided activities, and downtime to keep the event engaging and manageable for the guest count."}`,
    `Draft event schedule\n- ${concept.schedule || "Arrive early for vendor setup, set a calm welcome window, begin main programming on time, and reserve a flexible wind-down block for transitions or delays."}`,
    `Budget allocation\n- ${concept.budgetStrategy || `Protect the ${event.currency} ${event.budget.toLocaleString()} budget by prioritizing venue, hospitality, and comfort first, then allocate contingency for last-minute changes.`} Keep the guest count around ${event.guestCount} while preserving room for practical extras.`,
    `Vendor categories and selection criteria\n- Shortlist venue, hospitality, décor, sound and AV, and guest experience contacts. Evaluate them by trust, communication, fit with the event’s tone, lead time, and responsiveness before using any quote as a final decision.`,
    `Actionable planning tasks\n- ${concept.constraints || event.constraints || "List key decisions for venue access, signage, menu confirmations, staffing, RSVP follow-up, and a final run-through review."}\n- Confirm accessibility support and guest comfort items early.\n- Reserve a dedicated buffer for setup, guest flow, and contingency.`,
    `Alternatives for different budgets\n- ${concept.tradeOffs || "If the budget tightens, trim décor density before reducing hospitality or guest comfort. If the budget opens up, increase lighting, add lounge or activity layers, and preserve a contingency reserve."}`,
  ].join("\n\n");
}

export async function createEvent(formData: FormData) {
  const user = await requireUser();

  const raw = {
    name: formData.get("name"),
    type: formData.get("type") ?? "Wedding",
    date: formData.get("date") ?? "",
    location: formData.get("location") ?? "",
    guestCount: formData.get("guestCount") ?? 0,
    budget: formData.get("budget") ?? 0,
    currency: formData.get("currency") ?? "INR",
    theme: formData.get("theme") ?? "",
    style: formData.get("style") ?? "",
    description: formData.get("description") ?? "",
    notes: formData.get("notes") ?? "",
    constraints: formData.get("constraints") ?? "",
  };

  const parsed = eventFormSchema.safeParse(raw);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid event information.");
  }

  const safeBudget = toSafeMoney(parsed.data.budget, "Budget");

  const event = await prisma.event.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      date: parsed.data.date ? new Date(parsed.data.date) : null,
      location: parsed.data.location || null,
      guestCount: parsed.data.guestCount,
      budget: safeBudget,
      currency: parsed.data.currency,
      theme: parsed.data.theme || null,
      style: parsed.data.style || null,
      description: parsed.data.description || null,
      notes: parsed.data.notes || null,
      constraints: parsed.data.constraints || null,
      userId: user.id,
      categories: {
        create: [
          { name: "Venue", allocation: safeBudget * 0.25 },
          { name: "Catering", allocation: safeBudget * 0.3 },
          { name: "Decor", allocation: safeBudget * 0.15 },
          { name: "Entertainment", allocation: safeBudget * 0.15 },
          { name: "Contingency", allocation: safeBudget * 0.15, isContingency: true },
        ],
      },
    },
  });

  revalidatePath("/dashboard");
  redirect(`/events/${event.id}`);
}

export async function addExpense(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);

  const parsed = expenseSchema.safeParse({
    title: formData.get("title"),
    amount: formData.get("amount"),
    isActual: formData.get("isActual") ?? "",
    categoryId: formData.get("categoryId") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid expense");
  }

  const safeAmount = toSafeMoney(parsed.data.amount, "Expense amount");
  if (parsed.data.categoryId) {
    const category = await prisma.budgetCategory.findFirst({
      where: { id: parsed.data.categoryId, eventId },
      select: { id: true },
    });
    if (!category) {
      throw new Error("The selected budget category does not belong to this event.");
    }
  }

  await prisma.expense.create({
    data: {
      eventId,
      categoryId: parsed.data.categoryId || null,
      title: parsed.data.title,
      amount: safeAmount,
      isActual: parsed.data.isActual === "on",
      notes: parsed.data.notes || null,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/budget`);
}

export async function addTask(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);

  const parsed = taskSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    priority: formData.get("priority") ?? "medium",
    status: formData.get("status") ?? "pending",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid task");
  }

  await prisma.task.create({
    data: {
      eventId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      priority: parsed.data.priority,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/tasks`);
}

export async function addGuest(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);

  const parsed = guestSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    dietaryNotes: formData.get("dietaryNotes") ?? "",
    plusOne: formData.get("plusOne") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid guest");
  }

  await prisma.$transaction(async (tx) => {
    const guest = await tx.guest.create({
      data: {
        eventId,
        name: parsed.data.name,
        email: parsed.data.email || null,
        dietaryNotes: parsed.data.dietaryNotes || null,
        plusOne: parsed.data.plusOne === "on",
        notes: parsed.data.notes || null,
      },
    });

    await tx.rSVP.create({
      data: {
        guestId: guest.id,
        status: "pending",
      },
    });
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/guests`);
}

export async function addVendor(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);

  const parsed = vendorSchema.safeParse({
    name: formData.get("name"),
    category: formData.get("category"),
    contact: formData.get("contact") ?? "",
    status: formData.get("status") ?? "prospect",
    notes: formData.get("notes") ?? "",
    amount: formData.get("amount") ?? "",
    currency: formData.get("currency") ?? "INR",
    isConfirmed: formData.get("isConfirmed") ?? "",
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid vendor");
  }

  const safeAmount = parsed.data.amount === "" || parsed.data.amount === undefined
    ? null
    : toSafeMoney(parsed.data.amount, "Quote amount");
  await prisma.$transaction(async (tx) => {
    const vendor = await tx.vendor.create({
      data: {
        eventId,
        name: parsed.data.name,
        category: parsed.data.category,
        contact: parsed.data.contact || null,
        status: parsed.data.status,
        notes: parsed.data.notes || null,
      },
    });

    if (safeAmount !== null) {
      await tx.quotation.create({
        data: {
          vendorId: vendor.id,
          amount: safeAmount,
          currency: parsed.data.currency,
          isConfirmed: parsed.data.isConfirmed === "on",
          notes: parsed.data.notes || null,
        },
      });
    }
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/vendors`);
}

export async function generateVisionPlan(eventId: string, formData: FormData) {
  const { user } = await requireAuthorizedEvent(eventId);
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });

  const concept = planConceptSchema.safeParse({
    mood: formData.get("mood") ?? event.style ?? event.theme ?? "",
    palette: formData.get("palette") ?? "",
    lighting: formData.get("lighting") ?? "",
    activities: formData.get("activities") ?? "",
    menu: formData.get("menu") ?? "",
    accessibility: formData.get("accessibility") ?? "",
    schedule: formData.get("schedule") ?? "",
    constraints: formData.get("constraints") ?? event.constraints ?? "",
    budgetStrategy: formData.get("budgetStrategy") ?? "",
    tradeOffs: formData.get("tradeOffs") ?? "",
  });

  if (!concept.success) {
    throw new Error(concept.error.issues[0]?.message ?? "Enter valid planning details.");
  }

  const title = normalizeConceptValue(formData.get("title"), `${event.type} vision plan`);
  const content = buildVisionPlanContent(event, {
    mood: concept.data.mood ?? "",
    palette: concept.data.palette ?? "",
    lighting: concept.data.lighting ?? "",
    activities: concept.data.activities ?? "",
    menu: concept.data.menu ?? "",
    accessibility: concept.data.accessibility ?? "",
    schedule: concept.data.schedule ?? "",
    constraints: concept.data.constraints ?? "",
    budgetStrategy: concept.data.budgetStrategy ?? "",
    tradeOffs: concept.data.tradeOffs ?? "",
  });

  await prisma.planSection.create({
    data: {
      eventId,
      userId: user.id,
      title,
      content,
      assumptions: `Based on an event type of ${event.type}, a budget of ${event.currency} ${event.budget}, a guest count of ${event.guestCount}, and the saved logistical constraints.`,
      tradeOffs: concept.data.tradeOffs || "Trade-offs remain explicit so the organizer can compare budget, comfort, and guest experience before committing.",
    },
  });

  revalidatePath(`/events/${eventId}/ai`);
}

export async function createPlanSection(eventId: string) {
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const formData = new FormData();
  formData.set("title", `${event.type} vision plan`);
  formData.set("mood", event.style || event.theme || `Elegant ${event.type.toLowerCase()}`);
  formData.set("palette", "Warm ivory, forest green, and brushed gold");
  formData.set("lighting", "Layer warm uplighting, candlelight, and focused accents to make the key moments feel premium without overwhelming the room.");
  formData.set("activities", "Choose a low-friction program flow with clear welcome, key activity moments, and enough downtime to keep the experience relaxed and memorable.");
  formData.set("menu", "Keep food and hospitality choices practical and easy to execute with the guest count and venue footprint in mind.");
  formData.set("accessibility", "Maintain generous seating, quiet zones, and clear signage for comfort and accessibility.");
  formData.set("schedule", "Build a realistic departure from setup to event close with margin for transition and delays.");
  formData.set("constraints", event.constraints || "No major operating constraints have been noted yet.");
  formData.set("budgetStrategy", `Protect the ${event.currency} ${Number(event.budget || 0).toLocaleString()} budget with a practical allocation pattern that keeps venue, hospitality, and contingency at the center.`);
  formData.set("tradeOffs", "If the budget tightens, trim décor density before compromising hospitality, guest comfort, or vendor readiness.");

  await generateVisionPlan(eventId, formData);
  revalidatePath(`/events/${eventId}/ai`);
}

export async function updateTaskStatus(eventId: string, taskId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);
  const status = taskStatusSchema.safeParse(formData.get("status"));

  if (!status.success) {
    throw new Error(status.error.issues[0]?.message ?? "Select a valid task status.");
  }

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId }, select: { id: true } });
  if (!task) {
    throw new Error("Task not found for this event.");
  }

  await prisma.task.update({ where: { id: taskId }, data: { status: status.data } });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/tasks`);
}

export async function saveProposal(eventId: string, payload: { kind: string; summary: string; impactText: string }) {
  await requireAuthorizedEvent(eventId);
  const parsed = reviewNoteSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Enter a valid review note.");
  }

  await prisma.changeProposal.create({
    data: {
      eventId,
      kind: parsed.data.kind,
      summary: parsed.data.summary,
      impactText: parsed.data.impactText,
      status: "pending",
    },
  });

  revalidatePath(`/events/${eventId}/impact`);
}

export async function reviewProposal(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);

  await saveProposal(eventId, {
    kind: String(formData.get("kind") ?? "").trim() || "note",
    summary: String(formData.get("summary") ?? ""),
    impactText: String(formData.get("impactText") ?? ""),
  });
}

export async function deleteEvent(eventId: string) {
  await requireAuthorizedEvent(eventId);

  await prisma.event.delete({ where: { id: eventId } });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

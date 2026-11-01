"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { auth } from "@/auth";
import { buildEventBudgetContext } from "@/lib/budget-context";
import { toSafeMoney } from "@/lib/budget";
import { budgetDraftSchema, budgetProfileSchema } from "@/lib/budget-schema";
import prisma from "@/lib/prisma";
import {
  calculateScenarioImpact,
  scenarioFormSchema,
  parseScenarioProposal,
  scenarioProposalSchema,
} from "@/lib/scenario";
import { formatCurrency } from "@/lib/utils";
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

function buildVisionPlanContent(event: {
  name: string;
  type: string;
  currency: string;
  budget: number;
  guestCount: number;
  date: Date | null;
  location: string | null;
  description: string | null;
  notes: string | null;
  theme: string | null;
  style: string | null;
  constraints: string | null;
  tasks: Array<{ title: string; status: string; dueDate: Date | null }>;
  guests: Array<{ rsvp: { status: string } | null }>;
  vendors: Array<{ name: string; category: string; status: string; quotations: Array<{ isConfirmed: boolean }> }>;
}, concept: {
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
  const openTasks = event.tasks
    .filter((task) => task.status !== "done")
    .slice(0, 5)
    .map((task) => `${task.title} (${task.status}${task.dueDate ? `, due ${task.dueDate.toISOString().slice(0, 10)}` : ""})`);
  const pendingRsvps = event.guests.filter((guest) => !guest.rsvp || guest.rsvp.status === "pending").length;
  const vendorFollowUps = event.vendors
    .filter((vendor) => vendor.status !== "booked" || vendor.quotations.some((quote) => !quote.isConfirmed))
    .slice(0, 5)
    .map((vendor) => `${vendor.name} — ${vendor.category} (${vendor.status})`);
  const scheduleContext = event.date
    ? `Event date: ${event.date.toISOString().slice(0, 10)}`
    : "Event date is not set; use relative milestones rather than calendar dates.";

  return [
    `Saved event brief\n- ${event.name} is a ${event.type}${event.location ? ` in ${event.location}` : ""} for ${event.guestCount} guests${event.date ? ` on ${event.date.toISOString().slice(0, 10)}` : ""}.\n- ${event.description || "No description saved."}\n- Organizer notes: ${event.notes || "none"}\n- Constraints: ${event.constraints || "none saved."}` ,
    `Theme and visual direction\n- ${concept.mood || event.theme || event.style || `${event.type} styling`}. Keep the overall tone elevated and practical, with a polished editorial feel that still reads as a real event plan.`,
    `Color palette\n- ${concept.palette || "Warm ivory + forest green + brushed gold"}. This keeps the plan premium and versatile across hospitality, décor, staging, and signage.`,
    `Decoration and lighting ideas\n- ${concept.lighting || "Layer ambient lighting with statement focal points, using greenery and candles or warm uplighting to deepen the atmosphere without overloading the room."}`,
    `Activities and entertainment\n- ${concept.activities || "Design a clear flow of arrival, guided activities, and downtime to keep the event engaging and manageable for the guest count."}`,
    `Menu and hospitality\n- ${concept.menu || "Plan service style and dietary collection around the guest count and venue setup; confirm menu choices and service timing with the caterer."}`,
    `Accessibility and guest comfort\n- ${concept.accessibility || "Confirm step-free access, seating, clear signage, dietary needs, and a quiet area with the venue before finalizing the run sheet."}`,
    `Draft event schedule\n- ${concept.schedule || "Work backward from the event date: confirm key vendors and access first, finalize guest and menu details next, then schedule setup, arrival, main programming, transitions, and a contingency buffer."}\n- ${scheduleContext}`,
    `Budget allocation\n- ${concept.budgetStrategy || `Protect the ${event.currency} ${event.budget.toLocaleString()} budget by prioritizing venue, hospitality, and comfort first, then allocate contingency for last-minute changes.`} Keep the guest count around ${event.guestCount} while preserving room for practical extras.`,
    `Vendor follow-up\n- ${vendorFollowUps.join("; ") || "No outstanding vendor follow-ups are recorded. Confirm venue, hospitality, and technical requirements before booking."}\n- Evaluate vendors by fit, lead time, written scope, and responsiveness. Quotes remain separate from actual spend until recorded as expenses.`,
    `Recommended next actions\n- ${openTasks.join("; ") || "No open tasks are saved yet. Add venue access confirmation, menu and dietary checks, and a final run-through to the task list."}\n- ${pendingRsvps} guest response${pendingRsvps === 1 ? "" : "s"} still pending; schedule an RSVP follow-up.\n- ${concept.constraints || event.constraints || "Confirm the venue access window and staffing plan."}\n- Reserve a setup, guest-flow, and contingency buffer.`,
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
  const budgetDraftValue = formData.get("budgetDraft");
  let approvedBudgetDraft: ReturnType<typeof budgetDraftSchema.parse> | null = null;
  if (typeof budgetDraftValue === "string" && budgetDraftValue) {
    let draftInput: unknown;
    let profileInput: unknown;
    try {
      draftInput = JSON.parse(budgetDraftValue);
      profileInput = JSON.parse(String(formData.get("budgetDraftProfile") ?? ""));
    } catch {
      throw new Error("The approved budget draft is invalid. Generate and approve it again.");
    }

    const draft = budgetDraftSchema.safeParse(draftInput);
    const profile = budgetProfileSchema.safeParse(profileInput);
    if (!draft.success || !profile.success) {
      throw new Error("The approved budget draft is invalid. Generate and approve it again.");
    }
    if (
      profile.data.eventType !== parsed.data.type ||
      profile.data.location !== (parsed.data.location || "") ||
      profile.data.guestCount !== parsed.data.guestCount ||
      profile.data.budget !== safeBudget ||
      profile.data.currency !== parsed.data.currency ||
      profile.data.date !== (parsed.data.date || "") ||
      profile.data.context !== buildEventBudgetContext({
        name: parsed.data.name,
        theme: parsed.data.theme ?? "",
        style: parsed.data.style ?? "",
        description: parsed.data.description ?? "",
        notes: parsed.data.notes ?? "",
        constraints: parsed.data.constraints ?? "",
      })
    ) {
      throw new Error("Event details changed after the budget was generated. Generate the budget again before saving.");
    }
    approvedBudgetDraft = draft.data;
  }

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
        create: approvedBudgetDraft
          ? [
            ...approvedBudgetDraft.categories.map((category) => ({
              name: category.name,
              allocation: toSafeMoney(category.amount, "Category estimate"),
              notes: [
                `Indicative AI estimate; not a vendor quotation.`,
                `Priority: ${category.priority}.`,
                `Basis: ${category.basis}`,
                category.explanation,
                category.alternative ? `Lower-cost alternative: ${category.alternative}` : "",
                approvedBudgetDraft?.rationale ?? "",
                ...approvedBudgetDraft?.tradeOffs ?? [],
              ].filter(Boolean).join("\n"),
            })),
            {
              name: "Contingency",
              allocation: toSafeMoney(approvedBudgetDraft.contingency, "Contingency"),
              isContingency: true,
              notes: "Indicative AI planning reserve; not a vendor quotation.",
            },
          ]
          : [
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

export async function applyBudgetDraft(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);
  const rawDraft = formData.get("budgetDraft");
  if (typeof rawDraft !== "string" || !rawDraft) {
    throw new Error("Review and approve the budget draft before applying it.");
  }

  let draftInput: unknown;
  try {
    draftInput = JSON.parse(rawDraft);
  } catch {
    throw new Error("The approved budget draft is invalid.");
  }
  const parsed = budgetDraftSchema.safeParse(draftInput);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "The approved budget draft is invalid.");
  }

  const draft = parsed.data;
  await prisma.$transaction(async (transaction) => {
    const existing = await transaction.budgetCategory.findMany({ where: { eventId } });
    const remaining = new Map(existing.map((category) => [category.name.toLocaleLowerCase(), category]));
    const savedNames = new Set<string>();

    for (const category of draft.categories) {
      const nameKey = category.name.toLocaleLowerCase();
      savedNames.add(nameKey);
      const notes = [
        "Indicative planning estimate; not a verified vendor quotation.",
        `Priority: ${category.priority}.`,
        `Basis: ${category.basis}`,
        category.explanation,
        category.alternative ? `Lower-cost alternative: ${category.alternative}` : "",
        draft.rationale,
        ...draft.tradeOffs,
      ].filter(Boolean).join("\n");
      const matching = remaining.get(nameKey);
      if (matching) {
        await transaction.budgetCategory.update({
          where: { id: matching.id },
          data: { name: category.name, allocation: toSafeMoney(category.amount), notes, isContingency: false },
        });
      } else {
        await transaction.budgetCategory.create({
          data: { eventId, name: category.name, allocation: toSafeMoney(category.amount), notes },
        });
      }
    }

    const contingencyKey = "contingency";
    savedNames.add(contingencyKey);
    const existingContingency = remaining.get(contingencyKey);
    if (existingContingency) {
      await transaction.budgetCategory.update({
        where: { id: existingContingency.id },
        data: {
          name: "Contingency",
          allocation: toSafeMoney(draft.contingency),
          notes: "Indicative AI planning reserve; not a vendor quotation.",
          isContingency: true,
        },
      });
    } else {
      await transaction.budgetCategory.create({
        data: {
          eventId,
          name: "Contingency",
          allocation: toSafeMoney(draft.contingency),
          notes: "Indicative AI planning reserve; not a vendor quotation.",
          isContingency: true,
        },
      });
    }

    const obsoleteIds = existing
      .filter((category) => !savedNames.has(category.name.toLocaleLowerCase()))
      .map((category) => category.id);
    if (obsoleteIds.length > 0) {
      await transaction.expense.updateMany({
        where: { eventId, categoryId: { in: obsoleteIds } },
        data: { categoryId: null },
      });
      await transaction.budgetCategory.deleteMany({ where: { eventId, id: { in: obsoleteIds } } });
    }
  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/budget`);
  revalidatePath(`/events/${eventId}/tasks`);
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
  const event = await prisma.event.findUniqueOrThrow({
    where: { id: eventId },
    include: {
      tasks: { orderBy: { dueDate: "asc" } },
      guests: { include: { rsvp: true } },
      vendors: { include: { quotations: true } },
    },
  });

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
  await requireAuthorizedEvent(eventId);
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

export async function deleteTask(eventId: string, taskId: string) {
  await requireAuthorizedEvent(eventId);

  const task = await prisma.task.findFirst({ where: { id: taskId, eventId }, select: { id: true } });
  if (!task) {
    throw new Error("Task not found for this event.");
  }

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/tasks`);
}

export async function deleteExpense(eventId: string, expenseId: string) {
  await requireAuthorizedEvent(eventId);

  const expense = await prisma.expense.findFirst({ where: { id: expenseId, eventId }, select: { id: true } });
  if (!expense) {
    throw new Error("Expense not found for this event.");
  }

  await prisma.expense.delete({ where: { id: expenseId } });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/budget`);
}

export async function updateRsvpStatus(eventId: string, guestId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);

  const status = z.enum(["pending", "attending", "declined", "maybe"]).safeParse(formData.get("status"));
  if (!status.success) {
    throw new Error(status.error.issues[0]?.message ?? "Select a valid RSVP status.");
  }

  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId }, select: { id: true } });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  await prisma.rSVP.upsert({
    where: { guestId },
    update: { status: status.data, respondedAt: new Date() },
    create: { guestId, status: status.data, respondedAt: new Date() },
  });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/guests`);
}

export async function deleteGuest(eventId: string, guestId: string) {
  await requireAuthorizedEvent(eventId);

  const guest = await prisma.guest.findFirst({ where: { id: guestId, eventId }, select: { id: true } });
  if (!guest) {
    throw new Error("Guest not found for this event.");
  }

  await prisma.guest.delete({ where: { id: guestId } });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/guests`);
}

export async function deleteVendor(eventId: string, vendorId: string) {
  await requireAuthorizedEvent(eventId);

  const vendor = await prisma.vendor.findFirst({ where: { id: vendorId, eventId }, select: { id: true } });
  if (!vendor) {
    throw new Error("Vendor not found for this event.");
  }

  await prisma.vendor.delete({ where: { id: vendorId } });
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/vendors`);
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

export async function saveScenarioProposal(eventId: string, formData: FormData) {
  await requireAuthorizedEvent(eventId);
  const parsed = scenarioFormSchema.safeParse({
    budget: formData.get("budget"),
    guestCount: formData.get("guestCount"),
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Enter a valid budget and guest count.");
  }

  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });
  const scenario = scenarioProposalSchema.parse({
    version: 1,
    baseline: {
      budget: toSafeMoney(event.budget, "Current budget"),
      guestCount: event.guestCount,
    },
    proposed: {
      budget: toSafeMoney(parsed.data.budget, "Proposed budget"),
      guestCount: parsed.data.guestCount,
    },
  });
  const impact = calculateScenarioImpact(scenario);
  const budgetChange = impact.budgetDelta === 0
    ? "no change"
    : `${impact.budgetDelta > 0 ? "+" : "-"}${formatCurrency(Math.abs(impact.budgetDelta), event.currency)}`;
  const guestChange = impact.guestDelta === 0
    ? "no change"
    : `${impact.guestDelta > 0 ? "+" : ""}${impact.guestDelta}`;
  const impactText = [
    `Budget target: ${formatCurrency(scenario.baseline.budget, event.currency)} → ${formatCurrency(scenario.proposed.budget, event.currency)} (${budgetChange}).`,
    `Guest count: ${scenario.baseline.guestCount} → ${scenario.proposed.guestCount} (${guestChange}).`,
    `Budget per planned guest: ${formatCurrency(impact.currentBudgetPerGuest, event.currency)} → ${formatCurrency(impact.proposedBudgetPerGuest, event.currency)}.`,
    "Approval changes only the event budget target and guest count. Expenses, vendor quotations, and category allocations are not changed.",
  ].join("\n");

  await prisma.changeProposal.create({
    data: {
      eventId,
      kind: "what-if-scenario",
      summary: `Scenario: ${formatCurrency(scenario.proposed.budget, event.currency)} budget for ${scenario.proposed.guestCount} guests`,
      impactText,
      proposalData: JSON.stringify(scenario),
      status: "pending",
    },
  });
  revalidatePath(`/events/${eventId}/impact`);
}

export async function approveAndApplyScenario(eventId: string, proposalId: string) {
  await requireAuthorizedEvent(eventId);

  await prisma.$transaction(async (transaction) => {
    const proposal = await transaction.changeProposal.findFirst({
      where: { id: proposalId, eventId, kind: "what-if-scenario" },
    });
    if (!proposal || proposal.status !== "pending") {
      throw new Error("This scenario is not available for approval.");
    }

    const scenario = parseScenarioProposal(proposal.proposalData);
    if (!scenario) {
      throw new Error("This scenario is invalid. Create a new proposal.");
    }

    const update = await transaction.event.updateMany({
      where: {
        id: eventId,
        budget: scenario.baseline.budget,
        guestCount: scenario.baseline.guestCount,
      },
      data: {
        budget: scenario.proposed.budget,
        guestCount: scenario.proposed.guestCount,
      },
    });

    if (update.count !== 1) {
      await transaction.changeProposal.update({
        where: { id: proposal.id },
        data: { status: "stale" },
      });
      return;
    }

    const markedApproved = await transaction.changeProposal.updateMany({
      where: { id: proposal.id, eventId, status: "pending" },
      data: { status: "approved" },
    });
    if (markedApproved.count !== 1) {
      throw new Error("This scenario has already been reviewed.");
    }

  });

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/impact`);
}

export async function rejectScenarioProposal(eventId: string, proposalId: string) {
  await requireAuthorizedEvent(eventId);

  const result = await prisma.changeProposal.updateMany({
    where: { id: proposalId, eventId, kind: "what-if-scenario", status: "pending" },
    data: { status: "rejected" },
  });
  if (result.count !== 1) {
    throw new Error("This scenario is no longer pending review.");
  }

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

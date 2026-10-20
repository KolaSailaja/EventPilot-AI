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
  reviewNoteSchema,
  taskSchema,
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

export async function createPlanSection(eventId: string) {
  const { user } = await requireAuthorizedEvent(eventId);
  const event = await prisma.event.findUniqueOrThrow({ where: { id: eventId } });

  const safeTitle = event.theme ? `${event.type} theme direction` : "Planning direction";
  const content = `For ${event.name}, aim to maintain a ${event.type.toLowerCase()} experience with a guest list of ${event.guestCount} while respecting a ${event.currency} ${event.budget} budget. Prioritize high-impact decisions first.`;

  await prisma.planSection.create({
    data: {
      eventId,
      userId: user.id,
      title: safeTitle,
      content,
      assumptions: "Based on event budget, guest count, and available date.",
      tradeOffs: "Trade-offs are kept explicit and can be edited before applying changes.",
    },
  });

  revalidatePath(`/events/${eventId}/ai`);
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

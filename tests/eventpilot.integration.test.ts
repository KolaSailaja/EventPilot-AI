import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { buildEventBudgetContext } from "@/lib/budget-context";

const authState = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () =>
    authState.userId
      ? { user: { id: authState.userId, email: `${authState.userId}@example.test`, name: authState.userId } }
      : null,
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (destination: string) => {
    throw new Error(`REDIRECT:${destination}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

type PrismaClientType = import("@prisma/client").PrismaClient;
type EventActions = typeof import("../lib/event-actions");

let prisma: PrismaClientType;
let actions: EventActions;
let rateLimit: typeof import("../lib/rate-limit").rateLimit;
let authorizeCredentials: typeof import("../lib/credentials").authorizeCredentials;
let registerHandler: typeof import("../app/api/register/route").POST;
let generateBudgetHandler: typeof import("../app/api/budget/generate/route").POST;
let dashboardPage: () => Promise<unknown>;
let readPages: Array<(args: { params: Promise<{ id: string }> }) => Promise<unknown>>;
let databasePath: string;

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

function collectRenderedText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectRenderedText).join(" ");
  if (node && typeof node === "object" && "props" in node) {
    const element = node as { props?: { children?: unknown } };
    return collectRenderedText(element.props?.children);
  }
  return "";
}

async function createUser(id: string) {
  return prisma.user.create({
    data: {
      id,
      email: `${id}@example.test`,
      name: id,
      passwordHash: "$2b$12$testhashnotusedbythesechecks",
    },
  });
}

async function createEvent(userId: string, name = "Test event") {
  return prisma.event.create({
    data: { name, type: "Festival", budget: 1_000, guestCount: 20, userId },
  });
}

beforeAll(async () => {
  const dbName = `eventpilot-test-${process.pid}-${Date.now()}.db`;
  databasePath = path.resolve("prisma", dbName);
  const databaseUrl = `file:./${dbName}`;
  process.env.DATABASE_URL = databaseUrl;

  execFileSync(
    process.execPath,
    [
      path.resolve("node_modules/prisma/build/index.js"),
      "db",
      "push",
      "--schema",
      path.resolve("prisma/schema.prisma"),
      "--skip-generate",
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: "pipe",
    },
  );

  prisma = (await import("../lib/prisma")).default;
  actions = await import("../lib/event-actions");
  rateLimit = (await import("../lib/rate-limit")).rateLimit;
  authorizeCredentials = (await import("../lib/credentials")).authorizeCredentials;
  registerHandler = (await import("../app/api/register/route")).POST;
  generateBudgetHandler = (await import("../app/api/budget/generate/route")).POST;
  dashboardPage = (await import("../app/dashboard/page")).default;
  readPages = [
    (await import("../app/events/[id]/page")).default,
    (await import("../app/events/[id]/budget/page")).default,
    (await import("../app/events/[id]/tasks/page")).default,
    (await import("../app/events/[id]/vendors/page")).default,
    (await import("../app/events/[id]/guests/page")).default,
    (await import("../app/events/[id]/ai/page")).default,
    (await import("../app/events/[id]/impact/page")).default,
    (await import("../app/events/[id]/export/page")).default,
  ];
}, 30_000);

beforeEach(async () => {
  authState.userId = null;
  await prisma.user.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await prisma?.$disconnect();
  for (const file of [databasePath, `${databasePath}-journal`, `${databasePath}-wal`, `${databasePath}-shm`]) {
    if (file && existsSync(file)) unlinkSync(file);
  }
});

describe("database-backed event workflows", () => {
  it("creates events and their default categories in one persisted operation", async () => {
    await createUser("owner");
    authState.userId = "owner";

    await expect(
      actions.createEvent(
        form({
          name: "Autumn gathering",
          type: "Festival",
          date: "2026-11-08",
          guestCount: "120",
          budget: "5000.25",
          currency: "INR",
        }),
      ),
    ).rejects.toThrow(/^REDIRECT:\/events\//);

    const event = await prisma.event.findFirst({
      where: { userId: "owner", name: "Autumn gathering" },
      include: { categories: true },
    });
    expect(event?.budget).toBe(5000.25);
    expect(event?.categories).toHaveLength(5);
    expect(event?.categories.reduce((sum, category) => sum + category.allocation, 0)).toBeCloseTo(5000.25);
    expect(collectRenderedText(await dashboardPage())).toContain("Autumn gathering");
  });

  it("creates an event with an explicitly approved, context-matched budget draft", async () => {
    await createUser("owner");
    authState.userId = "owner";
    const draft = {
      categories: [{
        name: "Community space",
        amount: 800,
        basis: "One-day local venue",
        explanation: "Indicative estimate for a modest gathering.",
        priority: "high",
        alternative: "Public park",
      }],
      contingency: 100,
      rationale: "Confirm costs directly.",
      tradeOffs: ["Use a public space if available."],
    };
    const profile = {
      eventType: "Festival",
      location: "Pune",
      guestCount: 40,
      budget: 1_000,
      currency: "INR",
      date: "2026-11-08",
      priorities: "",
      context: buildEventBudgetContext({
        name: "Community festival",
        theme: "",
        style: "",
        description: "",
        notes: "",
        constraints: "",
      }),
    };

    await expect(actions.createEvent(form({
      name: "Community festival",
      type: "Festival",
      date: "2026-11-08",
      location: "Pune",
      guestCount: "40",
      budget: "1000",
      currency: "INR",
      budgetDraft: JSON.stringify(draft),
      budgetDraftProfile: JSON.stringify(profile),
    }))).rejects.toThrow(/^REDIRECT:\/events\//);

    const event = await prisma.event.findFirstOrThrow({
      where: { userId: "owner", name: "Community festival" },
      include: { categories: true },
    });
    expect(event.categories.map((category) => category.name)).toEqual(["Community space", "Contingency"]);
    expect(event.categories[0]?.notes).toContain("Indicative AI estimate");
    expect(event.categories.reduce((sum, category) => sum + category.allocation, 0)).toBe(900);
  });

  it("rejects an approved new-event budget after its planning context changes", async () => {
    await createUser("owner");
    authState.userId = "owner";

    const originalContext = buildEventBudgetContext({
      name: "Community festival",
      theme: "Local arts",
      style: "Outdoor",
      description: "An arts day for the neighborhood.",
      notes: "Prioritize local caterers.",
      constraints: "Step-free access.",
    });
    const draft = {
      categories: [{
        name: "Community space",
        amount: 800,
        basis: "One-day local venue",
        explanation: "Indicative estimate.",
        priority: "high",
        alternative: "Public park",
      }],
      contingency: 100,
      rationale: "Confirm costs directly.",
      tradeOffs: [],
    };
    const profile = {
      eventType: "Festival",
      location: "Pune",
      guestCount: 40,
      budget: 1_000,
      currency: "INR",
      date: "2026-11-08",
      priorities: "",
      context: originalContext,
    };

    await expect(actions.createEvent(form({
      name: "Community festival",
      type: "Festival",
      date: "2026-11-08",
      location: "Pune",
      guestCount: "40",
      budget: "1000",
      currency: "INR",
      theme: "Local arts",
      style: "Outdoor",
      description: "An arts day for the neighborhood.",
      notes: "Prioritize local caterers.",
      constraints: "Step-free access and vegetarian meals.",
      budgetDraft: JSON.stringify(draft),
      budgetDraftProfile: JSON.stringify(profile),
    }))).rejects.toThrow("Event details changed after the budget was generated");
    await expect(prisma.event.count({ where: { userId: "owner" } })).resolves.toBe(0);
  });

  it("does not persist generated drafts until approval, and applying twice does not duplicate categories", async () => {
    await createUser("owner");
    const event = await createEvent("owner");
    const oldCategory = await prisma.budgetCategory.create({
      data: { eventId: event.id, name: "Old allocation", allocation: 200 },
    });
    const expense = await prisma.expense.create({
      data: { eventId: event.id, categoryId: oldCategory.id, title: "Paid deposit", amount: 25, isActual: true },
    });
    await prisma.event.update({
      where: { id: event.id },
      data: {
        theme: "Community colors",
        style: "Accessible and relaxed",
        description: "An outdoor community arts festival.",
        notes: "Prioritize local caterers.",
        constraints: "Step-free access and vegetarian meals.",
      },
    });
    await prisma.task.create({ data: { eventId: event.id, title: "Confirm step-free venue", status: "pending" } });
    authState.userId = "owner";
    vi.stubEnv("OPENAI_API_KEY", "server-test-key");
    let providerRequestBody = "";
    vi.stubGlobal("fetch", vi.fn((_input: unknown, init?: RequestInit) => {
      providerRequestBody = String(init?.body ?? "");
      return Promise.resolve(new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            categories: [{
              name: "Food and hospitality",
              amount: 500,
              basis: "20 guests",
              explanation: "Simple shared meal estimate.",
              priority: "high",
              alternative: "Community potluck",
            }],
            contingency: 100,
            rationale: "Indicative only; confirm costs.",
            tradeOffs: ["Use a potluck to reduce food costs."],
          }),
        },
      }],
      }), { status: 200 }));
    }));

    const generated = await generateBudgetHandler(new Request("http://localhost/api/budget/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: event.id, priorities: "simple food" }),
    }));
    expect(generated.status).toBe(200);
    const providerPayload = JSON.parse(providerRequestBody) as { messages: Array<{ content: string }> };
    expect(providerPayload.messages[1]?.content).toContain("Step-free access and vegetarian meals");
    expect(providerPayload.messages[1]?.content).toContain("Community colors");
    expect(providerPayload.messages[1]?.content).toContain("Confirm step-free venue");
    expect(providerPayload.messages[1]?.content).toContain("INR 25 actual");
    expect(await prisma.budgetCategory.count({ where: { eventId: event.id } })).toBe(1);

    const approvedDraft = JSON.parse(await generated.text()).draft;
    const approval = form({ budgetDraft: JSON.stringify(approvedDraft) });
    await actions.applyBudgetDraft(event.id, approval);
    await actions.applyBudgetDraft(event.id, approval);

    const categories = await prisma.budgetCategory.findMany({ where: { eventId: event.id } });
    expect(categories).toHaveLength(2);
    expect(categories.map((category) => category.name).sort()).toEqual(["Contingency", "Food and hospitality"]);
    expect(categories.find((category) => category.name === "Food and hospitality")?.allocation).toBe(500);
    expect(await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).toMatchObject({
      amount: 25,
      isActual: true,
      categoryId: null,
    });
  });

  it("persists expenses, tasks, guests/RSVPs, vendors/quotes, and planning records", async () => {
    await createUser("owner");
    const event = await createEvent("owner");
    authState.userId = "owner";

    await actions.addExpense(
      event.id,
      form({ title: "Catering deposit", amount: "125.50", isActual: "on" }),
    );
    await actions.addTask(event.id, form({ title: "Confirm venue", dueDate: "2026-10-25" }));
    await actions.addGuest(event.id, form({ name: "Guest Person", email: "guest@example.test", plusOne: "on" }));
    await actions.addVendor(
      event.id,
      form({ name: "Sound crew", category: "Audio", amount: "450.25", isConfirmed: "on" }),
    );
    await actions.addVendor(event.id, form({ name: "Unpriced venue", category: "Venue" }));
    await actions.createPlanSection(event.id);
    await expect(actions.reviewProposal(event.id, form({}))).rejects.toThrow();
    await actions.saveProposal(event.id, {
      kind: "manual-note",
      summary: "Consider a smaller stage",
      impactText: "This is a manually entered review note.",
    });

    const persisted = await prisma.event.findUniqueOrThrow({
      where: { id: event.id },
      include: {
        expenses: true,
        tasks: true,
        guests: { include: { rsvp: true } },
        vendors: { include: { quotations: true } },
        planSections: true,
        proposals: true,
      },
    });
    expect(persisted.expenses[0]?.amount).toBe(125.5);
    expect(persisted.tasks[0]?.dueDate?.toISOString().slice(0, 10)).toBe("2026-10-25");
    expect(persisted.guests[0]?.rsvp?.status).toBe("pending");
    expect(persisted.guests[0]?.plusOne).toBe(true);
    expect(persisted.vendors[0]?.quotations[0]?.amount).toBe(450.25);
    expect(persisted.vendors.find((vendor) => vendor.name === "Unpriced venue")?.quotations).toHaveLength(0);
    expect(persisted.planSections).toHaveLength(1);
    expect(persisted.planSections[0]?.content).toContain("Menu and hospitality");
    expect(persisted.planSections[0]?.content).toContain("Accessibility and guest comfort");
    expect(persisted.planSections[0]?.content).toContain("Confirm venue");
    expect(persisted.planSections[0]?.content).toContain("1 guest response still pending");
    expect(persisted.proposals[0]?.status).toBe("pending");
  });

  it("creates, approves, rejects, and marks stale What-If scenario proposals", async () => {
    await createUser("owner");
    const event = await createEvent("owner");
    const category = await prisma.budgetCategory.create({
      data: { eventId: event.id, name: "Venue", allocation: 300 },
    });
    const expense = await prisma.expense.create({
      data: { eventId: event.id, title: "Venue deposit", amount: 25, isActual: true },
    });
    authState.userId = "owner";

    await actions.saveScenarioProposal(event.id, form({ budget: "1500.50", guestCount: "30" }));
    const proposal = await prisma.changeProposal.findFirstOrThrow({
      where: { eventId: event.id, kind: "what-if-scenario" },
    });
    expect(proposal.impactText).toContain("Budget target");
    expect(proposal.proposalData).toContain('"guestCount":30');

    await actions.approveAndApplyScenario(event.id, proposal.id);
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({
      budget: 1500.5,
      guestCount: 30,
    });
    expect(await prisma.budgetCategory.findUniqueOrThrow({ where: { id: category.id } })).toMatchObject({ allocation: 300 });
    expect(await prisma.expense.findUniqueOrThrow({ where: { id: expense.id } })).toMatchObject({ amount: 25, isActual: true });
    expect(await prisma.changeProposal.findUniqueOrThrow({ where: { id: proposal.id } })).toMatchObject({ status: "approved" });

    await expect(actions.saveScenarioProposal(event.id, form({ budget: "-1", guestCount: "30.5" }))).rejects.toThrow();
    await expect(prisma.changeProposal.count({ where: { eventId: event.id, kind: "what-if-scenario" } })).resolves.toBe(1);

    await actions.saveScenarioProposal(event.id, form({ budget: "1600", guestCount: "35" }));
    const staleProposal = await prisma.changeProposal.findFirstOrThrow({
      where: { eventId: event.id, kind: "what-if-scenario", status: "pending" },
    });
    await prisma.event.update({ where: { id: event.id }, data: { guestCount: 31 } });
    await actions.approveAndApplyScenario(event.id, staleProposal.id);
    expect(await prisma.changeProposal.findUniqueOrThrow({ where: { id: staleProposal.id } })).toMatchObject({ status: "stale" });
    expect(await prisma.event.findUniqueOrThrow({ where: { id: event.id } })).toMatchObject({ budget: 1500.5, guestCount: 31 });

    await actions.saveScenarioProposal(event.id, form({ budget: "1700", guestCount: "40" }));
    const rejectedProposal = await prisma.changeProposal.findFirstOrThrow({
      where: { eventId: event.id, kind: "what-if-scenario", status: "pending" },
    });
    await actions.rejectScenarioProposal(event.id, rejectedProposal.id);
    expect(await prisma.changeProposal.findUniqueOrThrow({ where: { id: rejectedProposal.id } })).toMatchObject({ status: "rejected" });
  });

  it("updates RSVP state and removes owned task, guest, vendor, and expense records", async () => {
    await createUser("owner");
    const event = await createEvent("owner");
    authState.userId = "owner";

    const task = await prisma.task.create({ data: { eventId: event.id, title: "Confirm venue", status: "pending" } });
    const guest = await prisma.guest.create({ data: { eventId: event.id, name: "Invitee Name", email: "invite@example.test" } });
    const guestRsvp = await prisma.rSVP.create({ data: { guestId: guest.id, status: "pending" } });
    const vendor = await prisma.vendor.create({ data: { eventId: event.id, name: "Printing partner", category: "Print" } });
    const expense = await prisma.expense.create({ data: { eventId: event.id, title: "Printing deposit", amount: 35, isActual: true } });

    await actions.updateTaskStatus(event.id, task.id, form({ status: "done" }));
    await actions.updateRsvpStatus(event.id, guest.id, form({ status: "attending" }));

    const updatedTask = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    const updatedRsvp = await prisma.rSVP.findUniqueOrThrow({ where: { id: guestRsvp.id } });
    expect(updatedTask.status).toBe("done");
    expect(updatedRsvp.status).toBe("attending");

    await actions.deleteTask(event.id, task.id);
    await actions.deleteGuest(event.id, guest.id);
    await actions.deleteVendor(event.id, vendor.id);
    await actions.deleteExpense(event.id, expense.id);

    await expect(prisma.task.findUnique({ where: { id: task.id } })).resolves.toBeNull();
    await expect(prisma.rSVP.findUnique({ where: { id: guestRsvp.id } })).resolves.toBeNull();
    await expect(prisma.vendor.findUnique({ where: { id: vendor.id } })).resolves.toBeNull();
    await expect(prisma.expense.findUnique({ where: { id: expense.id } })).resolves.toBeNull();
    await expect(prisma.task.count({ where: { eventId: event.id } })).resolves.toBe(0);
    await expect(prisma.guest.count({ where: { eventId: event.id } })).resolves.toBe(0);
    await expect(prisma.vendor.count({ where: { eventId: event.id } })).resolves.toBe(0);
    await expect(prisma.expense.count({ where: { eventId: event.id } })).resolves.toBe(0);
  });

  it("rejects cross-event category attachment", async () => {
    await createUser("owner");
    const event = await createEvent("owner", "Primary event");
    const otherEvent = await createEvent("owner", "Other event");
    const otherCategory = await prisma.budgetCategory.create({
      data: { eventId: otherEvent.id, name: "Private category" },
    });
    authState.userId = "owner";

    await expect(
      actions.addExpense(
        event.id,
        form({ title: "Misattached", amount: "10", categoryId: otherCategory.id }),
      ),
    ).rejects.toThrow("does not belong to this event");
    expect(await prisma.expense.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("rolls back vendor creation when quotation persistence fails", async () => {
    await createUser("owner");
    const event = await createEvent("owner");
    authState.userId = "owner";
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER fail_test_quote BEFORE INSERT ON "Quotation" BEGIN SELECT RAISE(ABORT, 'forced test failure'); END;`,
    );

    try {
      await expect(
        actions.addVendor(event.id, form({ name: "Atomic vendor", category: "Music", amount: "25" })),
      ).rejects.toThrow();
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER fail_test_quote;`);
    }

    expect(await prisma.vendor.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("deletes an owned event and cascades its related data", async () => {
    await createUser("owner");
    const event = await createEvent("owner");
    await prisma.task.create({ data: { eventId: event.id, title: "Delete with event" } });
    authState.userId = "owner";

    await expect(actions.deleteEvent(event.id)).rejects.toThrow("REDIRECT:/dashboard");
    expect(await prisma.event.findUnique({ where: { id: event.id } })).toBeNull();
    expect(await prisma.task.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.budgetCategory.count({ where: { eventId: event.id } })).toBe(0);
  });
});

describe("authorization isolation", () => {
  it("denies every event mutation to a different authenticated user", async () => {
    await createUser("owner");
    await createUser("intruder");
    const event = await createEvent("owner");
    authState.userId = "intruder";
    const vendorForm = form({ name: "Vendor", category: "Music", amount: "20" });
    const guestForm = form({ name: "Guest Name" });
    const taskForm = form({ title: "Task name" });
    const expenseForm = form({ title: "Expense name", amount: "20" });

    await expect(actions.addExpense(event.id, expenseForm)).rejects.toThrow("not authorized");
    await expect(actions.addTask(event.id, taskForm)).rejects.toThrow("not authorized");
    await expect(actions.addGuest(event.id, guestForm)).rejects.toThrow("not authorized");
    await expect(actions.addVendor(event.id, vendorForm)).rejects.toThrow("not authorized");
    await expect(actions.createPlanSection(event.id)).rejects.toThrow("not authorized");
    await expect(
      actions.saveProposal(event.id, { kind: "test", summary: "test", impactText: "test" }),
    ).rejects.toThrow("not authorized");
    await expect(actions.reviewProposal(event.id, form({ summary: "forged" }))).rejects.toThrow("not authorized");
    await expect(actions.updateTaskStatus(event.id, "missing-task", form({ status: "done" }))).rejects.toThrow("not authorized");
    await expect(actions.updateRsvpStatus(event.id, "missing-guest", form({ status: "attending" }))).rejects.toThrow("not authorized");
    await expect(actions.deleteTask(event.id, "missing-task")).rejects.toThrow("not authorized");
    await expect(actions.deleteGuest(event.id, "missing-guest")).rejects.toThrow("not authorized");
    await expect(actions.deleteVendor(event.id, "missing-vendor")).rejects.toThrow("not authorized");
    await expect(actions.deleteExpense(event.id, "missing-expense")).rejects.toThrow("not authorized");
    await expect(actions.saveScenarioProposal(event.id, form({ budget: "1200", guestCount: "25" }))).rejects.toThrow("not authorized");
    await expect(actions.approveAndApplyScenario(event.id, "missing-proposal")).rejects.toThrow("not authorized");
    await expect(actions.rejectScenarioProposal(event.id, "missing-proposal")).rejects.toThrow("not authorized");
    await expect(actions.deleteEvent(event.id)).rejects.toThrow("not authorized");
    await expect(actions.applyBudgetDraft(event.id, form({
      budgetDraft: JSON.stringify({
        categories: [{ name: "Venue", amount: 10, basis: "One day", explanation: "Estimate", priority: "high", alternative: "" }],
        contingency: 0,
        rationale: "Planning estimate",
        tradeOffs: [],
      }),
    }))).rejects.toThrow("not authorized");

    expect(await prisma.event.findUnique({ where: { id: event.id } })).not.toBeNull();
    expect(await prisma.expense.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.task.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.guest.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.vendor.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.planSection.count({ where: { eventId: event.id } })).toBe(0);
    expect(await prisma.changeProposal.count({ where: { eventId: event.id } })).toBe(0);
  });

  it("hides another user's event on every event read page", async () => {
    await createUser("owner");
    await createUser("intruder");
    const event = await createEvent("owner");
    authState.userId = "intruder";

    for (const page of readPages) {
      await expect(page({ params: Promise.resolve({ id: event.id }) })).rejects.toThrow("NOT_FOUND");
    }
  });

  it("requires authentication and event ownership for AI budget generation", async () => {
    await createUser("owner");
    await createUser("intruder");
    const event = await createEvent("owner");
    const request = new Request("http://localhost/api/budget/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ eventId: event.id }),
    });

    const anonymous = await generateBudgetHandler(request.clone());
    expect(anonymous.status).toBe(401);

    authState.userId = "intruder";
    const unauthorized = await generateBudgetHandler(request.clone());
    expect(unauthorized.status).toBe(404);
  });

  it("rate-limits repeated AI budget generation requests for an authenticated user", async () => {
    await createUser("owner");
    authState.userId = "owner";
    vi.stubEnv("OPENAI_API_KEY", "server-test-key");
    const providerResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            categories: [{
              name: "Community space",
              amount: 500,
              basis: "One day",
              explanation: "Indicative local estimate.",
              priority: "high",
              alternative: "",
            }],
            contingency: 50,
            rationale: "Confirm all costs locally.",
            tradeOffs: [],
          }),
        },
      }],
    };
    const fetchMock = vi.fn().mockImplementation(
      () => Promise.resolve(new Response(JSON.stringify(providerResponse), { status: 200 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sendRequest = () => generateBudgetHandler(new Request("http://localhost/api/budget/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventType: "Community gathering",
        location: "Pune",
        guestCount: 20,
        budget: 1_000,
        currency: "INR",
        date: "",
        priorities: "",
      }),
    }));
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) responses.push(await sendRequest());

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200, 200, 429]);
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });
});

describe("registration, credentials, and rate limiting", () => {
  it("registers a normalized account and handles duplicate and invalid submissions", async () => {
    const requestFor = (fields: Record<string, string>) => {
      const body = form(fields);
      return new Request("http://localhost/api/register", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.10" },
        body,
      });
    };

    const created = await registerHandler(
      requestFor({ name: "New User", email: "  PERSON@Example.test  ", password: "correct horse 123" }),
    );
    expect(created.status).toBe(200);
    expect(await prisma.user.findUnique({ where: { email: "person@example.test" } })).not.toBeNull();

    const duplicate = await registerHandler(
      requestFor({ name: "New User", email: "person@example.test", password: "correct horse 123" }),
    );
    expect(duplicate.status).toBe(409);

    const invalid = await registerHandler(
      requestFor({ name: "x", email: "not-an-email", password: "short" }),
    );
    expect(invalid.status).toBe(400);

    const crossOrigin = await registerHandler(
      new Request("http://localhost/api/register", {
        method: "POST",
        headers: { origin: "https://attacker.example" },
        body: form({ name: "X", email: "cross@example.test", password: "valid password 123" }),
      }),
    );
    expect(crossOrigin.status).toBe(403);

    const concurrentRequests = await Promise.all([
      registerHandler(requestFor({ name: "Race", email: "race@example.test", password: "valid password 123" })),
      registerHandler(requestFor({ name: "Race", email: "race@example.test", password: "valid password 123" })),
    ]);
    expect(concurrentRequests.map((response) => response.status).sort()).toEqual([200, 409]);

    const oversizedForm = form({ name: "Large", email: "large@example.test", password: "valid password 123" });
    oversizedForm.set("extra", "x".repeat(17 * 1024));
    const oversized = await registerHandler(
      new Request("http://localhost/api/register", {
        method: "POST",
        headers: { "x-forwarded-for": "192.0.2.12" },
        body: oversizedForm,
      }),
    );
    expect(oversized.status).toBe(413);
  }, 15_000);

  it("authenticates valid credentials and rejects bad or oversized passwords", async () => {
    const { hash } = await import("bcryptjs");
    const passwordHash = await hash("valid password 123", 4);
    await prisma.user.create({
      data: { id: "login-user", email: "login@example.test", passwordHash },
    });
    const request = new Request("http://localhost/api/auth/callback/credentials", {
      headers: { "x-forwarded-for": "192.0.2.11" },
    });

    await expect(
      authorizeCredentials({ email: "LOGIN@example.test", password: "valid password 123" }, request),
    ).resolves.toMatchObject({ id: "login-user", email: "login@example.test" });
    await expect(
      authorizeCredentials({ email: "login@example.test", password: "incorrect password" }, request),
    ).resolves.toBeNull();
    await expect(
      authorizeCredentials({ email: "login@example.test", password: "é".repeat(40) }, request),
    ).resolves.toBeNull();
  });

  it("enforces rate limits atomically for concurrent requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () => rateLimit("concurrent-test-key", 5, 60_000)),
    );
    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(results.filter((result) => !result.allowed)).toHaveLength(15);
  });
});

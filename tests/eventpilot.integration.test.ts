import { execFileSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
});

beforeEach(async () => {
  authState.userId = null;
  await prisma.user.deleteMany();
  await prisma.rateLimitBucket.deleteMany();
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
    expect(persisted.proposals[0]?.status).toBe("pending");
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
    await expect(actions.deleteEvent(event.id)).rejects.toThrow("not authorized");

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

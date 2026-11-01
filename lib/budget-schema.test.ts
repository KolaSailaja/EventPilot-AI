import { afterEach, describe, expect, it, vi } from "vitest";

import { BudgetProviderError, generateBudgetWithAI } from "@/lib/ai-budget-provider";
import { budgetDraftSchema, summarizeBudgetDraft, type BudgetProfile } from "@/lib/budget-schema";

const profile: BudgetProfile = {
  eventType: "Community festival",
  location: "Pune",
  guestCount: 120,
  budget: 100_000,
  currency: "INR",
  date: "2026-11-12",
  priorities: "accessible venue, local food",
  context: "Community event with step-free venue access.",
};

const draft = {
  categories: [
    { name: "Community venue", amount: 50_000, basis: "One day rental", explanation: "Estimate assumes a local community space.", priority: "high", alternative: "Outdoor public space" },
    { name: "Food", amount: 35_000, basis: "120 guests", explanation: "Simple shared meal.", priority: "high", alternative: "Potluck" },
  ],
  contingency: 5_000,
  rationale: "Indicative planning estimate; confirm costs locally.",
  tradeOffs: ["Use a public space to reduce venue costs."],
} as const;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("AI budget draft validation and arithmetic", () => {
  it("calculates category spending, reserve, remaining amount, and shortfall deterministically", () => {
    const valid = budgetDraftSchema.parse(draft);
    expect(summarizeBudgetDraft(valid, 100_000)).toEqual({
      plannedSpending: 85_000,
      contingency: 5_000,
      allocated: 90_000,
      remaining: 10_000,
      unallocated: 10_000,
      shortfall: 0,
    });
    expect(summarizeBudgetDraft(valid, 80_000).shortfall).toBe(5_000);
  });

  it("rounds each amount to cents before adding and flags overspending", () => {
    const valid = budgetDraftSchema.parse({
      ...draft,
      categories: [
        { ...draft.categories[0], amount: 0.105 },
        { ...draft.categories[1], amount: 1.005 },
      ],
      contingency: 0.015,
    });
    expect(summarizeBudgetDraft(valid, 1).plannedSpending).toBe(1.12);
    expect(summarizeBudgetDraft(valid, 1).contingency).toBe(0.02);
    expect(summarizeBudgetDraft(valid, 1).shortfall).toBe(0.12);
  });

  it.each([
    ["negative amount", { ...draft, categories: [{ ...draft.categories[0], amount: -1 }] }],
    ["non-finite amount", { ...draft, categories: [{ ...draft.categories[0], amount: Number.NaN }] }],
    ["unknown field", { ...draft, extra: "not allowed" }],
    ["duplicate category", { ...draft, categories: [draft.categories[0], { ...draft.categories[0] }] }],
    ["reserved category", { ...draft, categories: [{ ...draft.categories[0], name: "Contingency" }] }],
  ])("rejects invalid output (%s)", (_description, invalid) => {
    expect(budgetDraftSchema.safeParse(invalid).success).toBe(false);
  });
});

describe("AI budget provider", () => {
  it("requires server-side provider configuration", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(generateBudgetWithAI(profile)).rejects.toMatchObject({ status: 503 });
  });

  it("maps provider rate limits and failures to clear errors", async () => {
    vi.stubEnv("OPENAI_API_KEY", "server-test-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 429 })));
    await expect(generateBudgetWithAI(profile)).rejects.toMatchObject({ status: 429 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
    await expect(generateBudgetWithAI(profile)).rejects.toMatchObject({ status: 502 });
  });

  it("maps provider timeouts and rejects malformed or unsafe AI output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "server-test-key");
    const timeout = new Error("timed out");
    timeout.name = "TimeoutError";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(timeout));
    await expect(generateBudgetWithAI(profile)).rejects.toMatchObject({ status: 504 });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({ ...draft, categories: [{ ...draft.categories[0], amount: -20 }] }) } }],
    }), { status: 200 })));
    await expect(generateBudgetWithAI(profile)).rejects.toBeInstanceOf(BudgetProviderError);
  });

  it("returns validated provider output as rounded estimates", async () => {
    vi.stubEnv("OPENAI_API_KEY", "server-test-key");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify(draft) } }],
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateBudgetWithAI(profile);
    expect(result.categories).toHaveLength(2);
    expect(result.contingency).toBe(5_000);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      messages: Array<{ content: string }>;
    };
    expect(requestBody.messages[1]?.content).toContain(profile.context);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer server-test-key" }),
      }),
    );
  });
});

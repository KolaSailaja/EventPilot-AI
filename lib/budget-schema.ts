import { z } from "zod";

import { toSafeMoney } from "@/lib/budget";

export const budgetProfileSchema = z.object({
  eventType: z.string().trim().min(2).max(100),
  location: z.string().trim().max(200).default(""),
  guestCount: z.number().int().min(1).max(1_000_000),
  budget: z.number().finite().min(0).max(1_000_000_000_000),
  currency: z.enum(["INR", "USD", "AED", "EUR"]),
  date: z.string().max(10).refine((value) => {
    if (value === "") return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }, "Enter a valid event date.").default(""),
  priorities: z.string().trim().max(300).default(""),
});

export const budgetDraftSchema = z.object({
  categories: z.array(z.object({
    name: z.string().trim().min(2).max(80),
    amount: z.number().finite().min(0).max(1_000_000_000_000),
    basis: z.string().trim().min(2).max(200),
    explanation: z.string().trim().min(2).max(500),
    priority: z.enum(["high", "medium", "low"]),
    alternative: z.string().trim().max(300).default(""),
  }).strict()).min(1).max(20),
  contingency: z.number().finite().min(0).max(1_000_000_000_000),
  rationale: z.string().trim().min(2).max(1000),
  tradeOffs: z.array(z.string().trim().min(2).max(300)).max(5),
}).strict().superRefine((draft, context) => {
  const categoryNames = draft.categories.map((category) => category.name.toLocaleLowerCase());
  if (new Set(categoryNames).size !== categoryNames.length) {
    context.addIssue({ code: "custom", message: "Budget categories must have unique names." });
  }
  if (categoryNames.includes("contingency")) {
    context.addIssue({ code: "custom", message: "Contingency is reserved for the separate contingency estimate." });
  }

  const amounts = [...draft.categories.map((category) => category.amount), draft.contingency];
  if (amounts.some((amount) => !Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000)) return;

  const totalCents = amounts.reduce((sum, amount) => sum + Math.round(amount * 100), 0);
  if (!Number.isSafeInteger(totalCents) || totalCents > 100_000_000_000_000) {
    context.addIssue({ code: "custom", message: "The generated budget total is outside the supported range." });
  }
});

export type BudgetDraft = z.infer<typeof budgetDraftSchema>;
export type BudgetProfile = z.infer<typeof budgetProfileSchema>;

export function summarizeBudgetDraft(draft: BudgetDraft, budget: number) {
  const plannedSpending = draft.categories.reduce(
    (sum, category) => sum + Math.round(toSafeMoney(category.amount) * 100),
    0,
  );
  const contingency = Math.round(toSafeMoney(draft.contingency) * 100);
  const totalBudget = Math.round(toSafeMoney(budget, "Budget") * 100);
  const allocated = plannedSpending + contingency;

  return {
    plannedSpending: plannedSpending / 100,
    contingency: contingency / 100,
    allocated: allocated / 100,
    remaining: (totalBudget - allocated) / 100,
    unallocated: Math.max(0, totalBudget - allocated) / 100,
    shortfall: Math.max(0, plannedSpending - totalBudget) / 100,
  };
}

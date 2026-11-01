import { z } from "zod";

import { toSafeMoney } from "@/lib/budget";

const moneySchema = z.number().finite().min(0).max(1_000_000_000_000);

export const scenarioProposalSchema = z.object({
  version: z.literal(1),
  baseline: z.object({
    budget: moneySchema,
    guestCount: z.number().int().min(1).max(1_000_000),
  }).strict(),
  proposed: z.object({
    budget: moneySchema,
    guestCount: z.number().int().min(1).max(1_000_000),
  }).strict(),
}).strict();

export const scenarioFormSchema = z.object({
  budget: z.coerce.number().finite().min(0).max(1_000_000_000_000),
  guestCount: z.coerce.number().int().min(1).max(1_000_000),
});

export type ScenarioProposal = z.infer<typeof scenarioProposalSchema>;

export function parseScenarioProposal(value: string | null): ScenarioProposal | null {
  if (!value) return null;

  try {
    const parsed: unknown = JSON.parse(value);
    const result = scenarioProposalSchema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function isScenarioStale(
  scenario: ScenarioProposal,
  current: { budget: number; guestCount: number },
) {
  return (
    toSafeMoney(current.budget) !== scenario.baseline.budget ||
    current.guestCount !== scenario.baseline.guestCount
  );
}

export function calculateScenarioImpact(scenario: ScenarioProposal) {
  const budgetDeltaCents = Math.round(scenario.proposed.budget * 100) - Math.round(scenario.baseline.budget * 100);
  const guestDelta = scenario.proposed.guestCount - scenario.baseline.guestCount;

  return {
    budgetDelta: budgetDeltaCents / 100,
    guestDelta,
    currentBudgetPerGuest: scenario.baseline.budget / scenario.baseline.guestCount,
    proposedBudgetPerGuest: scenario.proposed.budget / scenario.proposed.guestCount,
  };
}

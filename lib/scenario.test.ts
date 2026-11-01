import { describe, expect, it } from "vitest";

import {
  calculateScenarioImpact,
  isScenarioStale,
  parseScenarioProposal,
  scenarioProposalSchema,
} from "@/lib/scenario";

const scenario = {
  version: 1 as const,
  baseline: { budget: 100_000, guestCount: 100 },
  proposed: { budget: 120_000, guestCount: 125 },
};

describe("scenario proposals", () => {
  it("calculates deterministic budget and guest impacts", () => {
    expect(calculateScenarioImpact(scenario)).toEqual({
      budgetDelta: 20_000,
      guestDelta: 25,
      currentBudgetPerGuest: 1_000,
      proposedBudgetPerGuest: 960,
    });
  });

  it("detects changed baselines and accepts unchanged baselines", () => {
    expect(isScenarioStale(scenario, scenario.baseline)).toBe(false);
    expect(isScenarioStale(scenario, { ...scenario.baseline, budget: 99_999 })).toBe(true);
    expect(isScenarioStale(scenario, { ...scenario.baseline, guestCount: 101 })).toBe(true);
  });

  it("rejects malformed or out-of-range stored proposals", () => {
    expect(parseScenarioProposal("{bad json")).toBeNull();
    expect(parseScenarioProposal(JSON.stringify({ ...scenario, proposed: { budget: -1, guestCount: 125 } }))).toBeNull();
    expect(scenarioProposalSchema.safeParse({
      ...scenario,
      proposed: { budget: 120_000, guestCount: 1.5 },
    }).success).toBe(false);
  });
});

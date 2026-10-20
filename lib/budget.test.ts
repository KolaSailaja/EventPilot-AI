import { describe, expect, it } from "vitest";

import { calculateBudgetSummary, toSafeMoney } from "@/lib/budget";
import { eventFormSchema, taskSchema } from "@/lib/validators";

describe("budget calculations", () => {
  it("computes actual, planned and remaining totals from stored entries", () => {
    const summary = calculateBudgetSummary(5000, [
      { amount: 1200, isActual: true },
      { amount: 350, isActual: true },
      { amount: 500, isActual: false },
    ]);

    expect(summary).toEqual({
      totalBudget: 5000,
      actual: 1550,
      planned: 500,
      remaining: 3450,
    });
  });

  it("rejects invalid or negative money amounts", () => {
    expect(() => toSafeMoney(-1, "Budget")).toThrow("Budget must be a valid non-negative number.");
    expect(() => toSafeMoney(Number.NaN, "Expense amount")).toThrow();
  });

  it("rounds half-cent values consistently before aggregation", () => {
    expect(toSafeMoney("1.005")).toBe(1.01);
    expect(toSafeMoney("0.015")).toBe(0.02);
    expect(toSafeMoney("9.995")).toBe(10);
    expect(calculateBudgetSummary(1, [
      { amount: "0.10", isActual: true },
      { amount: "0.20", isActual: true },
    ]).actual).toBe(0.3);
  });

  it("rejects scientific notation beyond the supported range", () => {
    expect(() => toSafeMoney("1e12")).not.toThrow();
    expect(() => toSafeMoney("1e13")).toThrow();
  });
});

describe("validation schemas", () => {
  it("accepts a valid event payload", () => {
    const parsed = eventFormSchema.parse({
      name: "Spring gala",
      type: "Festival",
      guestCount: 120,
      budget: 5000,
      currency: "INR",
      date: "2026-09-15",
      location: "Mumbai",
    });

    expect(parsed.name).toBe("Spring gala");
    expect(parsed.budget).toBe(5000);
  });

  it("rejects invalid task priority or negative values", () => {
    expect(() => taskSchema.parse({ title: "Book venue", priority: "urgent" })).toThrow();
    expect(() => eventFormSchema.parse({ name: "x", type: "Festival", guestCount: 0, budget: -1 })).toThrow();
  });

  it("rejects impossible dates, fractional guest counts, and unsupported currencies", () => {
    expect(() => taskSchema.parse({ title: "Book venue", dueDate: "2026-02-30" })).toThrow();
    expect(() => eventFormSchema.parse({
      name: "Gala event",
      type: "Festival",
      guestCount: 1.5,
      budget: 10,
      currency: "FAKE",
    })).toThrow();
  });
});

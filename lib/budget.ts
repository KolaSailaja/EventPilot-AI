export type BudgetEntry = {
  amount: number | string;
  isActual?: boolean;
};

export function toSafeMoney(value: number | string | null | undefined, label = "Amount") {
  const numeric = Number(value ?? 0);

  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 1_000_000_000_000) {
    throw new Error(`${label} must be a valid non-negative number.`);
  }

  const normalized = numeric.toFixed(12).replace(/(\.\d*?[1-9])0+$|\.0+$/, "$1");
  const [whole, fraction = ""] = normalized.split(".");
  const centsString = `${whole || "0"}${fraction.padEnd(2, "0").slice(0, 2)}`;
  const remainder = fraction.slice(2);
  const cents = Number(centsString || "0");
  const roundedCents = cents + (remainder.length > 0 && remainder[0] >= "5" ? 1 : 0);

  return roundedCents / 100;
}

export function calculateBudgetSummary(
  totalBudget: number | string,
  entries: BudgetEntry[] = [],
) {
  const budget = toSafeMoney(totalBudget, "Budget");
  const actual = entries
    .filter((entry) => entry.isActual)
    .reduce((sum, entry) => sum + toSafeMoney(entry.amount, "Expense amount"), 0);
  const planned = entries
    .filter((entry) => !entry.isActual)
    .reduce((sum, entry) => sum + toSafeMoney(entry.amount, "Planned amount"), 0);

  return {
    totalBudget: Number(budget.toFixed(2)),
    actual: Number(actual.toFixed(2)),
    planned: Number(planned.toFixed(2)),
    remaining: Number((budget - actual).toFixed(2)),
  };
}

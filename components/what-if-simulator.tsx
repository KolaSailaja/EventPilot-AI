"use client";

import { useMemo, useState } from "react";

import { formatCurrency } from "@/lib/utils";

type Props = {
  currentBudget: number;
  currentGuestCount: number;
  currency: string;
  eventType: string;
  vendorQuote: number;
  allocations: Array<{ name: string; allocation: number }>;
};

const categoryBlueprint = [
  { name: "Venue", share: 0.25 },
  { name: "Catering", share: 0.3 },
  { name: "Decor", share: 0.15 },
  { name: "Entertainment", share: 0.15 },
  { name: "Contingency", share: 0.15 },
];

export function EventWhatIfSimulator({
  currentBudget,
  currentGuestCount,
  currency,
  eventType,
  vendorQuote,
  allocations,
}: Props) {
  const clampNumeric = (value: number, fallback: number, minimum = 0) => {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(minimum, value);
  };

  const [guestCount, setGuestCount] = useState(currentGuestCount);
  const [budget, setBudget] = useState(currentBudget);
  const [quoteDelta, setQuoteDelta] = useState(vendorQuote);

  const projectedBudget = Math.max(0, budget + quoteDelta);
  const delta = projectedBudget - currentBudget;
  const guestImpact = guestCount - currentGuestCount;

  const categoryBreakdown = useMemo(
    () => {
      if (allocations.length > 0) {
        return allocations.map((category) => ({
          name: category.name,
          current: category.allocation,
          projected: currentBudget > 0 ? category.allocation * (projectedBudget / currentBudget) : 0,
        }));
      }

      return categoryBlueprint.map((category) => ({
        name: category.name,
        current: currentBudget * category.share,
        projected: projectedBudget * category.share,
      }));
    },
    [allocations, currentBudget, projectedBudget],
  );

  const status = delta > 0 ? "Buffer under pressure" : delta < 0 ? "Savings created" : "Stable";

  return (
    <section className="surface rounded-[28px] p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">What-if simulator</p>
          <h3 className="mt-2 text-2xl font-black text-stone-900">Scenario planner</h3>
        </div>
        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
          {status}
        </span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-block">
              <span>Guest count</span>
              <input
                type="number"
                min={0}
                value={guestCount}
                onChange={(event) => setGuestCount(clampNumeric(Number(event.target.value), currentGuestCount, 0))}
                className="field-input"
              />
            </label>
            <label className="field-block">
              <span>Budget target</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={budget}
                onChange={(event) => setBudget(clampNumeric(Number(event.target.value), currentBudget, 0))}
                className="field-input"
              />
            </label>
          </div>

          <label className="field-block">
            <span>Vendor quote delta</span>
            <input
              type="number"
              step="0.01"
              value={quoteDelta}
              onChange={(event) => setQuoteDelta(clampNumeric(Number(event.target.value), vendorQuote, -1_000_000_000_000))}
              className="field-input"
            />
          </label>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>Deterministic delta</span>
              <strong className={`text-base font-bold ${delta > 0 ? "text-amber-700" : delta < 0 ? "text-emerald-700" : "text-stone-900"}`}>
                {delta >= 0 ? "+" : "-"}
                {formatCurrency(Math.abs(delta), currency)}
              </strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className={`h-full rounded-full ${delta > 0 ? "bg-amber-500" : delta < 0 ? "bg-emerald-500" : "bg-stone-400"}`}
                style={{ width: `${Math.min(100, Math.abs((delta / Math.max(currentBudget, 1)) * 100))}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Impact summary</p>
          <div className="mt-4 space-y-3 text-sm text-stone-700">
            <div className="flex items-center justify-between">
              <span>Current budget</span>
              <strong>{formatCurrency(currentBudget, currency)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Projected budget</span>
              <strong>{formatCurrency(projectedBudget, currency)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Guest delta</span>
              <strong>{guestImpact >= 0 ? `+${guestImpact}` : guestImpact}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Event type</span>
              <strong>{eventType}</strong>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-emerald-200 bg-white/80 p-3 text-sm text-stone-700">
            <p className="font-semibold text-stone-900">Deterministic logic</p>
            <p className="mt-1">Budget changes and guest shifts are recalculated in-app. Narrative suggestions remain clearly labeled as planning guidance, not confirmed pricing or vendor availability.</p>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {categoryBreakdown.map((category) => (
          <div key={category.name} className="rounded-2xl border border-stone-200 bg-white p-3">
            <div className="flex items-center justify-between text-sm text-stone-600">
              <span>{category.name}</span>
              <strong className="text-stone-900">{formatCurrency(category.projected, currency)}</strong>
            </div>
            <p className="mt-1 text-xs text-stone-500">Current allocation: {formatCurrency(category.current, currency)}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-stone-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-400"
                style={{ width: `${Math.min(100, (category.projected / Math.max(projectedBudget, 1)) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

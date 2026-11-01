"use client";

import { useState } from "react";

import { saveScenarioProposal } from "@/lib/event-actions";
import { formatCurrency } from "@/lib/utils";

type Props = {
  eventId: string;
  currentBudget: number;
  currentGuestCount: number;
  actualSpend: number;
  currency: string;
  eventType: string;
};

export function EventWhatIfSimulator({
  eventId,
  currentBudget,
  currentGuestCount,
  actualSpend,
  currency,
  eventType,
}: Props) {
  const [guestCount, setGuestCount] = useState(currentGuestCount);
  const [budget, setBudget] = useState(currentBudget);
  const budgetDelta = budget - currentBudget;
  const guestDelta = guestCount - currentGuestCount;
  const remainingAfterSpend = budget - actualSpend;

  return (
    <section className="surface rounded-[28px] p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="eyebrow">What-if simulator</p>
          <h3 className="mt-2 text-2xl font-black text-stone-900">Scenario planner</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] ${
          budgetDelta > 0 ? "bg-amber-100 text-amber-800" : budgetDelta < 0 ? "bg-emerald-100 text-emerald-800" : "bg-stone-100 text-stone-700"
        }`}>
          {budgetDelta > 0 ? "Higher budget target" : budgetDelta < 0 ? "Lower budget target" : "Budget unchanged"}
        </span>
      </div>

      <form action={saveScenarioProposal.bind(null, eventId)} className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="field-block">
              <span>Proposed guest count</span>
              <input
                name="guestCount"
                type="number"
                min={1}
                max={1_000_000}
                step={1}
                value={guestCount}
                onChange={(event) => setGuestCount(Number(event.target.value))}
                className="field-input"
              />
            </label>
            <label className="field-block">
              <span>Proposed budget target ({currency})</span>
              <input
                name="budget"
                type="number"
                min={0}
                max={1_000_000_000_000}
                step="0.01"
                value={budget}
                onChange={(event) => setBudget(Number(event.target.value))}
                className="field-input"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-stone-900">Calculated changes</p>
            <dl className="mt-3 space-y-2 text-sm text-stone-600">
              <div className="flex items-center justify-between">
                <dt>Budget target change</dt>
                <dd className={`font-bold ${budgetDelta > 0 ? "text-amber-700" : budgetDelta < 0 ? "text-emerald-700" : "text-stone-900"}`}>
                  {budgetDelta > 0 ? "+" : budgetDelta < 0 ? "−" : ""}{formatCurrency(Math.abs(budgetDelta), currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Guest-count change</dt>
                <dd className="font-bold text-stone-900">{guestDelta > 0 ? "+" : ""}{guestDelta}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Actual spend recorded</dt>
                <dd className="font-bold text-stone-900">{formatCurrency(actualSpend, currency)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Budget after actual spend</dt>
                <dd className={`font-bold ${remainingAfterSpend < 0 ? "text-red-700" : "text-stone-900"}`}>
                  {formatCurrency(remainingAfterSpend, currency)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold uppercase tracking-[0.14em] text-emerald-700">Scenario preview</p>
          <div className="mt-4 space-y-3 text-sm text-stone-700">
            <div className="flex items-center justify-between">
              <span>Event type</span>
              <strong>{eventType}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Current → proposed budget</span>
              <strong>{formatCurrency(currentBudget, currency)} → {formatCurrency(budget, currency)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Current → proposed guests</span>
              <strong>{currentGuestCount} → {guestCount}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span>Budget per planned guest</span>
              <strong>{formatCurrency(budget / guestCount, currency)}</strong>
            </div>
          </div>
          <p className="mt-5 rounded-xl border border-emerald-200 bg-white/80 p-3 text-sm leading-6 text-stone-700">
            Saving creates a reviewable proposal only. Approval updates the event budget target and guest count; it does not change expenses, quotes, or category allocations.
          </p>
          <button type="submit" className="mt-4 w-full rounded-xl bg-stone-900 px-4 py-3 font-semibold text-white">
            Save scenario for review
          </button>
        </div>
      </form>
    </section>
  );
}

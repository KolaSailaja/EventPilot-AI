"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { applyBudgetDraft } from "@/lib/event-actions";
import { budgetDraftSchema, summarizeBudgetDraft, type BudgetDraft } from "@/lib/budget-schema";
import { formatCurrency } from "@/lib/utils";

type EventProfile = {
  eventType: string;
  location: string;
  guestCount: number;
  budget: number;
  currency: string;
  date: string;
  categories: Array<{
    name: string;
    allocation: number;
    notes: string | null;
    isContingency: boolean;
  }>;
};

type Props =
  | { mode: "new"; eventId?: never; profile?: never }
  | { mode: "saved"; eventId: string; profile: EventProfile };

function ApplyButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className="brand-emerald rounded-xl px-5 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60">
      {pending ? "Saving budget…" : "Apply this budget"}
    </button>
  );
}

export function EventCreateSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="brand-emerald rounded-full px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 disabled:cursor-wait disabled:opacity-60">
      {pending ? "Saving event…" : "Save and open event"}
    </button>
  );
}

export function BudgetGenerator(props: Props) {
  const [priorities, setPriorities] = useState("");
  const [draft, setDraft] = useState<BudgetDraft | null>(null);
  const [draftSource, setDraftSource] = useState<"ai" | "saved">("ai");
  const [approved, setApproved] = useState(false);
  const [draftProfile, setDraftProfile] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState("");
  const eventBudget = props.mode === "saved" ? props.profile.budget : null;
  const eventCurrency = props.mode === "saved" ? props.profile.currency : null;
  const [newEventBudget, setNewEventBudget] = useState(0);
  const [newEventCurrency, setNewEventCurrency] = useState("INR");
  const budget = eventBudget ?? newEventBudget;
  const currency = eventCurrency ?? newEventCurrency;
  const summary = draft ? summarizeBudgetDraft(draft, budget) : null;

  function updateDraft(next: BudgetDraft) {
    setDraft(next);
    setApproved(false);
  }

  function editSavedAllocations() {
    if (draft && !window.confirm("Discard the current draft and load the saved allocations for editing?")) return;
    if (props.mode !== "saved") return;

    const categories = props.profile.categories.filter(
      (category) => !category.isContingency && category.name.toLocaleLowerCase() !== "contingency",
    );
    const contingency = props.profile.categories
      .filter((category) => category.isContingency || category.name.toLocaleLowerCase() === "contingency")
      .reduce((sum, category) => sum + category.allocation, 0);
    const editableDraft: BudgetDraft = {
      categories: categories.map((category) => {
        const lines = (category.notes ?? "").split("\n");
        const priorityLine = lines.find((line) => /^Priority:\s*(high|medium|low)\.?$/i.test(line));
        const basisLine = lines.find((line) => line.startsWith("Basis: "));
        const alternativeLine = lines.find((line) => line.startsWith("Lower-cost alternative: "));
        const explanation = lines.filter((line) =>
          line && line !== "Indicative AI estimate; not a vendor quotation." &&
          line !== "Indicative planning estimate; not a verified vendor quotation." &&
          !/^Priority:\s*(high|medium|low)\.?$/i.test(line) &&
          !line.startsWith("Basis: ") &&
          !line.startsWith("Lower-cost alternative: "),
        ).join("\n").slice(0, 500);

        return {
          name: category.name,
          amount: category.allocation,
          basis: basisLine?.slice("Basis: ".length, "Basis: ".length + 200) || "Saved allocation",
          explanation: explanation || "Saved allocation. Add assumptions if useful.",
          priority: (priorityLine?.match(/high|medium|low/i)?.[0].toLowerCase() ?? "medium") as "high" | "medium" | "low",
          alternative: alternativeLine?.slice("Lower-cost alternative: ".length, "Lower-cost alternative: ".length + 300) ?? "",
        };
      }),
      contingency,
      rationale: "These are the current saved allocations. Any changes remain a draft until you approve and apply them.",
      tradeOffs: [],
    };
    setDraft(editableDraft);
    setDraftSource("saved");
    setApproved(false);
    setError("");
  }

  async function generate() {
    if (draft && !window.confirm("Replace the current draft, including your edits, with new suggestions?")) return;

    setError("");
    setIsGenerating(true);
    try {
      let payload: Record<string, unknown>;
      if (props.mode === "saved") {
        payload = { eventId: props.eventId, priorities };
      } else {
        const form = document.activeElement instanceof HTMLElement
          ? document.activeElement.closest("form")
          : null;
        const eventForm = form ?? document.querySelector<HTMLFormElement>("form");
        if (!eventForm) throw new Error("Complete the event details before generating a budget.");
        const data = new FormData(eventForm);
        payload = {
          eventType: data.get("type") ?? "",
          location: data.get("location") ?? "",
          guestCount: Number(data.get("guestCount")),
          budget: Number(data.get("budget")),
          currency: data.get("currency") ?? "INR",
          date: data.get("date") ?? "",
          priorities,
        };
        setNewEventBudget(Number(payload.budget));
        setNewEventCurrency(String(payload.currency));
        setDraftProfile(JSON.stringify(payload));
      }

      const response = await fetch("/api/budget/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { draft?: unknown; error?: string };
      if (!response.ok) throw new Error(result.error || "Budget generation failed. Please try again.");

      const validated = budgetDraftSchema.safeParse(result.draft);
      if (!validated.success) throw new Error("The generated budget could not be validated. Please try again.");
      setDraft(validated.data);
      setDraftSource("ai");
      setApproved(false);
      if (props.mode === "new") setDraftProfile(JSON.stringify(payload));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Budget generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50/70 p-5 md:p-6" aria-labelledby="budget-generator-title">
      {props.mode === "new" && (
        <>
          <input type="hidden" name="budgetDraft" value={approved && draft ? JSON.stringify(draft) : ""} />
          <input type="hidden" name="budgetDraftProfile" value={approved ? draftProfile : ""} />
        </>
      )}

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="eyebrow text-emerald-800">A thoughtful first estimate</p>
          <h2 id="budget-generator-title" className="mt-2 text-xl font-bold text-stone-900">Generate my budget with AI</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
            {props.mode === "new"
              ? "We’ll use the event details above. Add a few priorities if you like."
              : `Using your saved ${props.profile.eventType.toLowerCase()} details${props.profile.location ? ` in ${props.profile.location}` : ""}.`}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {props.mode === "saved" && (
            <button type="button" onClick={editSavedAllocations} disabled={isGenerating} className="rounded-xl border border-emerald-800 px-4 py-3 font-semibold text-emerald-900 disabled:opacity-60">
              Edit saved allocations
            </button>
          )}
          <button type="button" onClick={generate} disabled={isGenerating} className="brand-emerald rounded-xl px-5 py-3 font-bold text-white disabled:cursor-wait disabled:opacity-60">
            {isGenerating ? "Creating suggestions…" : draftSource === "ai" && draft ? "Regenerate suggestions" : "Generate my budget with AI"}
          </button>
        </div>
      </div>

      <label className="field-block mt-4">
        <span>What matters most? (optional)</span>
        <input
          value={priorities}
          onChange={(event) => setPriorities(event.target.value)}
          maxLength={300}
          placeholder="For example: great food, live music, accessible venue"
          className="field-input"
        />
      </label>

      <p className="mt-3 text-xs leading-5 text-stone-600">
        These are indicative AI estimates, not verified prices or vendor quotations. Confirm actual costs directly with vendors.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
      )}

      {draft && summary && (
        <div className="mt-5 space-y-4">
          {draftSource === "saved" && (
            <p className="rounded-xl border border-stone-200 bg-white p-3 text-sm text-stone-700">
              You’re editing saved allocations. Changes stay in this draft until you approve and apply them.
            </p>
          )}
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-white p-4 text-sm">
            <p>Planned categories <strong className="ml-1">{formatCurrency(summary.plannedSpending, currency)}</strong></p>
            <label className="flex items-center gap-2">
              <span className="font-medium">Contingency</span>
              <input
                aria-label="Contingency estimate"
                type="number"
                min={0}
                step="0.01"
                value={draft.contingency}
                onChange={(event) => updateDraft({ ...draft, contingency: Number(event.target.value) })}
                className="w-32 rounded-lg border border-stone-300 px-2 py-1"
              />
            </label>
            <p>Total allocated <strong className="ml-1">{formatCurrency(summary.allocated, currency)}</strong></p>
            <p className={summary.remaining < 0 ? "font-semibold text-red-700" : ""}>
              {summary.remaining < 0 ? "Over budget" : "Unallocated"} <strong className="ml-1">{formatCurrency(Math.abs(summary.remaining), currency)}</strong>
            </p>
          </div>

          {summary.remaining < 0 && (
            <div role="status" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              {summary.shortfall > 0
                ? `The expense categories alone exceed the stated budget by ${formatCurrency(summary.shortfall, currency)} before contingency. `
                : "The expense categories fit the stated budget, but the contingency reserve puts total allocations over by "}
              {summary.shortfall > 0
                ? `Including contingency, total allocations are ${formatCurrency(Math.abs(summary.remaining), currency)} over budget. `
                : `${formatCurrency(Math.abs(summary.remaining), currency)}. `}
              Consider a smaller guest list, a simpler venue or menu, fewer optional services, or a smaller reserve.
            </div>
          )}

          <div className="space-y-3">
            {draft.categories.map((category, index) => (
              <article key={`${category.name}-${index}`} className="rounded-2xl border border-stone-200 bg-white p-4">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                  <label className="field-block">
                    <span>Category</span>
                    <input value={category.name} maxLength={80} onChange={(event) => {
                      const categories = draft.categories.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item);
                      updateDraft({ ...draft, categories });
                    }} className="field-input" />
                  </label>
                  <label className="field-block">
                    <span>Estimated cost ({currency})</span>
                    <input aria-label={`${category.name} estimated cost`} type="number" min={0} step="0.01" value={category.amount} onChange={(event) => {
                      const categories = draft.categories.map((item, itemIndex) => itemIndex === index ? { ...item, amount: Number(event.target.value) } : item);
                      updateDraft({ ...draft, categories });
                    }} className="field-input" />
                  </label>
                  <button type="button" onClick={() => updateDraft({ ...draft, categories: draft.categories.filter((_, itemIndex) => itemIndex !== index) })} aria-label={`Remove ${category.name}`} className="self-end rounded-xl border border-stone-300 px-3 py-3 text-sm font-semibold text-stone-700 hover:bg-stone-50">
                    Remove
                  </button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="field-block">
                    <span>Quantity or calculation basis</span>
                    <input value={category.basis} maxLength={200} onChange={(event) => {
                      const categories = draft.categories.map((item, itemIndex) => itemIndex === index ? { ...item, basis: event.target.value } : item);
                      updateDraft({ ...draft, categories });
                    }} className="field-input" />
                  </label>
                  <label className="field-block">
                    <span>Priority</span>
                    <select value={category.priority} onChange={(event) => {
                      const categories = draft.categories.map((item, itemIndex) => itemIndex === index ? { ...item, priority: event.target.value as "high" | "medium" | "low" } : item);
                      updateDraft({ ...draft, categories });
                    }} className="field-input">
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </label>
                  <label className="field-block md:col-span-2">
                    <span>Explanation and assumptions</span>
                    <textarea value={category.explanation} maxLength={500} rows={2} onChange={(event) => {
                      const categories = draft.categories.map((item, itemIndex) => itemIndex === index ? { ...item, explanation: event.target.value } : item);
                      updateDraft({ ...draft, categories });
                    }} className="field-input resize-y" />
                  </label>
                  <label className="field-block md:col-span-2">
                    <span>Lower-cost alternative (optional)</span>
                    <input value={category.alternative} maxLength={300} onChange={(event) => {
                      const categories = draft.categories.map((item, itemIndex) => itemIndex === index ? { ...item, alternative: event.target.value } : item);
                      updateDraft({ ...draft, categories });
                    }} className="field-input" />
                  </label>
                </div>
              </article>
            ))}
          </div>

          <button type="button" onClick={() => {
            if (draft.categories.length >= 20) return;
            updateDraft({
              ...draft,
              categories: [...draft.categories, {
                name: `New category ${draft.categories.length + 1}`,
                amount: 0,
                basis: "Organizer estimate",
                explanation: "Add your estimate and assumptions.",
                priority: "medium",
                alternative: "",
              }],
            });
          }} disabled={draft.categories.length >= 20} className="rounded-xl border border-emerald-800 px-4 py-2.5 text-sm font-semibold text-emerald-900 disabled:opacity-50">
            Add a category
          </button>

          <label className="field-block">
            <span>Budget assumptions</span>
            <textarea value={draft.rationale} maxLength={1000} rows={3} onChange={(event) => updateDraft({ ...draft, rationale: event.target.value })} className="field-input resize-y" />
          </label>

          {draft.tradeOffs.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Possible trade-offs</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {draft.tradeOffs.map((tradeOff, index) => <li key={`${index}-${tradeOff}`}>{tradeOff}</li>)}
              </ul>
            </div>
          )}

          {props.mode === "new" ? (
            <button type="button" onClick={() => setApproved(true)} disabled={approved || !budgetDraftSchema.safeParse(draft).success} className="rounded-xl bg-stone-900 px-5 py-3 font-bold text-white disabled:opacity-60">
              {approved ? "Budget approved for event creation" : "Use this budget for my new event"}
            </button>
          ) : (
            <form action={applyBudgetDraft.bind(null, props.eventId)} className="flex flex-wrap items-center gap-3">
              <input type="hidden" name="budgetDraft" value={approved ? JSON.stringify(draft) : ""} />
              <button type="button" onClick={() => setApproved(true)} disabled={approved || !budgetDraftSchema.safeParse(draft).success} className="rounded-xl border border-emerald-800 px-5 py-3 font-bold text-emerald-900 disabled:opacity-60">
                {approved ? "Approved" : "Review and approve draft"}
              </button>
              <ApplyButton disabled={!approved || !budgetDraftSchema.safeParse(draft).success} />
              <span className="text-sm text-stone-600">Applying replaces category allocations only after approval.</span>
            </form>
          )}
          {!approved && <p className="text-sm text-stone-600">This is only a draft. Review and approve it before it is saved.</p>}
        </div>
      )}
    </section>
  );
}

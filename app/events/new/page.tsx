import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { BudgetGenerator, EventCreateSubmitButton } from "@/components/budget-generator";
import { createEvent } from "@/lib/event-actions";

export default async function NewEventPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 lg:px-6">
      <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="eyebrow">New event</p>
          <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] text-stone-900">Create your event brief</h1>
        </div>
        <a href="/dashboard" className="text-sm font-semibold text-stone-700 transition hover:text-stone-900">Back to dashboard</a>
      </div>

      <form action={createEvent} className="surface rounded-[32px] p-6 md:p-8">
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="eyebrow text-emerald-700">1</p>
            <p className="mt-2 font-bold text-stone-900">Vision</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="eyebrow">2</p>
            <p className="mt-2 font-bold text-stone-900">Budget</p>
          </div>
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
            <p className="eyebrow">3</p>
            <p className="mt-2 font-bold text-stone-900">Plan</p>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="field-block" htmlFor="name">
              <span>Event name</span>
              <input id="name" name="name" required className="field-input" />
            </label>
          </div>

          <label className="field-block" htmlFor="type">
            <span>Event type</span>
            <select id="type" name="type" defaultValue="Wedding" className="field-input">
              <option>Wedding</option>
              <option>Birthday</option>
              <option>Anniversary</option>
              <option>College Event</option>
              <option>Festival</option>
              <option>Community Gathering</option>
              <option>Other</option>
            </select>
          </label>

          <label className="field-block" htmlFor="date">
            <span>Event date</span>
            <input id="date" name="date" type="date" className="field-input" />
          </label>

          <label className="field-block" htmlFor="location">
            <span>Location</span>
            <input id="location" name="location" className="field-input" />
          </label>

          <label className="field-block" htmlFor="guestCount">
            <span>Guest count</span>
            <input id="guestCount" name="guestCount" type="number" min={1} defaultValue={150} className="field-input" />
          </label>

          <label className="field-block" htmlFor="budget">
            <span>Budget</span>
            <input id="budget" name="budget" type="number" min={0} step="0.01" defaultValue={250000} className="field-input" />
          </label>

          <label className="field-block" htmlFor="currency">
            <span>Currency</span>
            <select id="currency" name="currency" defaultValue="INR" className="field-input">
              <option>INR</option>
              <option>USD</option>
              <option>AED</option>
              <option>EUR</option>
            </select>
          </label>

          <label className="field-block" htmlFor="theme">
            <span>Theme</span>
            <input id="theme" name="theme" className="field-input" />
          </label>

          <label className="field-block" htmlFor="style">
            <span>Style</span>
            <input id="style" name="style" className="field-input" />
          </label>

          <div className="md:col-span-2">
            <label className="field-block" htmlFor="description">
              <span>Description</span>
              <textarea id="description" name="description" rows={3} className="field-input" />
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="field-block" htmlFor="constraints">
              <span>Constraints</span>
              <textarea id="constraints" name="constraints" rows={2} className="field-input" />
            </label>
          </div>

          <div className="md:col-span-2">
            <label className="field-block" htmlFor="notes">
              <span>Planning notes</span>
              <textarea id="notes" name="notes" rows={2} className="field-input" />
            </label>
          </div>
        </div>

        <BudgetGenerator mode="new" aiConfigured={Boolean(process.env.OPENAI_API_KEY)} />

        <div className="mt-8 flex justify-end">
          <EventCreateSubmitButton />
        </div>
      </form>
    </main>
  );
}

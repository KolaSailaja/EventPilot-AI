import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { createEvent } from "@/lib/event-actions";

export default async function NewEventPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-stone-500">New event</p>
          <h1 className="text-3xl font-black text-stone-900">Create your event plan</h1>
        </div>
        <a href="/dashboard" className="text-sm font-medium text-stone-700">Back to dashboard</a>
      </div>

      <form action={createEvent} className="card space-y-6 rounded-[28px] p-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="name">Event name</label>
            <input id="name" name="name" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="type">Event type</label>
            <select id="type" name="type" defaultValue="Wedding" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500">
              <option>Wedding</option>
              <option>Birthday</option>
              <option>Anniversary</option>
              <option>College Event</option>
              <option>Festival</option>
              <option>Community Gathering</option>
              <option>Other</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="date">Event date</label>
            <input id="date" name="date" type="date" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="location">Location</label>
            <input id="location" name="location" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="guestCount">Guest count</label>
            <input id="guestCount" name="guestCount" type="number" min={1} defaultValue={150} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="budget">Budget</label>
            <input id="budget" name="budget" type="number" min={0} step="0.01" defaultValue={250000} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="currency">Currency</label>
            <select id="currency" name="currency" defaultValue="INR" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500">
              <option>INR</option>
              <option>USD</option>
              <option>AED</option>
              <option>EUR</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="theme">Theme</label>
            <input id="theme" name="theme" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="style">Style</label>
            <input id="style" name="style" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={3} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="constraints">Constraints</label>
            <textarea id="constraints" name="constraints" rows={2} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-stone-700" htmlFor="notes">Planning notes</label>
            <textarea id="notes" name="notes" rows={2} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="rounded-full bg-amber-600 px-6 py-3 font-medium text-white hover:bg-amber-700">
            Save and open event
          </button>
        </div>
      </form>
    </main>
  );
}

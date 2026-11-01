import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { addGuest, deleteGuest, updateRsvpStatus } from "@/lib/event-actions";
import prisma from "@/lib/prisma";

export default async function GuestsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { guests: { include: { rsvp: true } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="card rounded-3xl p-6">
          <h2 className="text-xl font-bold text-stone-900">Guests and RSVP</h2>
          <form action={addGuest.bind(null, event.id)} className="mt-5 grid gap-3 md:grid-cols-3">
            <input name="name" aria-label="Guest name" placeholder="Guest name" required className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="email" aria-label="Guest email" type="email" placeholder="Email" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="dietaryNotes" aria-label="Guest dietary notes" placeholder="Dietary notes" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-700 md:col-span-3">
              <input type="checkbox" name="plusOne" /> Guest may bring a plus one
            </label>
            <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2.5 font-medium text-white md:col-span-3">Add guest</button>
          </form>
        </div>

        <div className="mt-8 space-y-4">
          {event.guests.length === 0 ? (
            <div className="card rounded-3xl p-6 text-stone-600">No guests added yet.</div>
          ) : (
            event.guests.map((guest) => (
              <div key={guest.id} className="card rounded-3xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-stone-900">{guest.name}</p>
                    <p className="text-sm text-stone-500">{guest.email || "Email not shared"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">{guest.rsvp?.status || "pending"}</span>
                </div>
                {guest.dietaryNotes && <p className="mt-3 text-sm text-stone-600">Dietary notes: {guest.dietaryNotes}</p>}
                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <form action={updateRsvpStatus.bind(null, event.id, guest.id)} className="flex items-center gap-2">
                    <select name="status" defaultValue={guest.rsvp?.status || "pending"} className="rounded-xl border border-stone-300 bg-stone-50 px-2.5 py-2 text-sm">
                      <option value="pending">Pending</option>
                      <option value="attending">Attending</option>
                      <option value="declined">Declined</option>
                      <option value="maybe">Maybe</option>
                    </select>
                    <button type="submit" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700">Update RSVP</button>
                  </form>
                  <form action={deleteGuest.bind(null, event.id, guest.id)}>
                    <button type="submit" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">Delete</button>
                  </form>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

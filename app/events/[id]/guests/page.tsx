import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { addGuest } from "@/lib/event-actions";
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
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

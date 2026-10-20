import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { reviewProposal } from "@/lib/event-actions";
import prisma from "@/lib/prisma";

export default async function ImpactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { proposals: true },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="card rounded-3xl p-6">
          <h2 className="text-xl font-bold text-stone-900">Change review notes</h2>
          <p className="mt-2 text-sm text-stone-600">These are manual pending notes only. They do not calculate impacts or change event data.</p>
          <form action={reviewProposal.bind(null, event.id)} className="mt-5 grid gap-3 md:grid-cols-2">
            <input name="kind" aria-label="Change note category" placeholder="Category (optional)" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="summary" aria-label="Change note summary" placeholder="Summary" required className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <textarea name="impactText" aria-label="Change note details" rows={4} placeholder="Notes and alternatives" required className="rounded-xl border border-stone-300 px-3 py-2.5 md:col-span-2" />
            <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2.5 font-medium text-white md:col-span-2">Save review note</button>
          </form>
        </div>

        <div className="mt-8 space-y-4">
          {event.proposals.length === 0 ? (
            <div className="card rounded-3xl p-6 text-stone-600">No review notes yet.</div>
          ) : (
            event.proposals.map((proposal) => (
              <div key={proposal.id} className="card rounded-3xl p-5">
                <p className="text-sm uppercase tracking-[0.18em] text-stone-500">{proposal.kind}</p>
                <h3 className="mt-2 text-xl font-bold text-stone-900">{proposal.summary}</h3>
                <p className="mt-3 text-stone-700">{proposal.impactText}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

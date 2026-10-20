import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { createPlanSection } from "@/lib/event-actions";
import prisma from "@/lib/prisma";

export default async function AIPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { planSections: { orderBy: { generatedAt: "desc" } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="card rounded-3xl p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-stone-500">Planning studio</p>
              <h2 className="mt-2 text-2xl font-bold text-stone-900">Create a planning note</h2>
              <p className="mt-2 text-sm text-stone-600">This deterministic starter text uses saved event details. No external AI provider is connected.</p>
            </div>
            <form action={createPlanSection.bind(null, event.id)}>
              <button type="submit" className="rounded-full bg-amber-600 px-5 py-3 font-medium text-white">Create planning note</button>
            </form>
          </div>
        </div>

        <div className="mt-8 space-y-4">
          {event.planSections.length === 0 ? (
            <div className="card rounded-3xl p-6 text-stone-600">No planning notes have been created yet.</div>
          ) : (
            event.planSections.map((section) => (
              <div key={section.id} className="card rounded-3xl p-6">
                <h3 className="text-xl font-bold text-stone-900">{section.title}</h3>
                <p className="mt-3 text-stone-700">{section.content}</p>
                <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
                  <p><strong>Assumptions:</strong> {section.assumptions || "None specified."}</p>
                  <p className="mt-2"><strong>Trade-offs:</strong> {section.tradeOffs || "None specified."}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import {
  approveAndApplyScenario,
  rejectScenarioProposal,
  reviewProposal,
  saveScenarioProposal,
} from "@/lib/event-actions";
import prisma from "@/lib/prisma";
import { isScenarioStale, parseScenarioProposal } from "@/lib/scenario";
import { formatCurrency } from "@/lib/utils";

export default async function ImpactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { proposals: { orderBy: { createdAt: "desc" } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="card rounded-3xl p-6">
          <h2 className="text-xl font-bold text-stone-900">Build a What-If proposal</h2>
          <p className="mt-2 text-sm text-stone-600">
            Compare a new budget target and guest count. The server calculates the impact from the current event; nothing changes until you explicitly approve and apply the proposal.
          </p>
          <form action={saveScenarioProposal.bind(null, event.id)} className="mt-5 grid gap-3 md:grid-cols-2">
            <label className="field-block">
              <span>Proposed budget ({event.currency})</span>
              <input name="budget" type="number" min={0} max={1_000_000_000_000} step="0.01" defaultValue={Number(event.budget)} required className="field-input" />
            </label>
            <label className="field-block">
              <span>Proposed guest count</span>
              <input name="guestCount" type="number" min={1} max={1_000_000} step={1} defaultValue={event.guestCount} required className="field-input" />
            </label>
            <button type="submit" className="rounded-xl bg-emerald-800 px-4 py-2.5 font-medium text-white md:col-span-2">Save scenario for review</button>
          </form>

          <h3 className="mt-8 text-lg font-bold text-stone-900">Manual planning note</h3>
          <p className="mt-2 text-sm text-stone-600">Use this for considerations that are not changes to event data.</p>
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
                {(() => {
                  const scenario = proposal.kind === "what-if-scenario" ? parseScenarioProposal(proposal.proposalData) : null;
                  const stale = scenario
                    ? proposal.status === "stale" || isScenarioStale(scenario, event)
                    : false;
                  const status = stale && proposal.status === "pending" ? "stale" : proposal.status;

                  return (
                    <>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-sm uppercase tracking-[0.18em] text-stone-500">{proposal.kind === "what-if-scenario" ? "What-If scenario" : proposal.kind}</p>
                        <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-stone-700">{status}</span>
                      </div>
                      <h3 className="mt-2 text-xl font-bold text-stone-900">{proposal.summary}</h3>
                      <p className="mt-3 whitespace-pre-line text-stone-700">{proposal.impactText}</p>
                      {scenario && stale && proposal.status === "pending" ? (
                        <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                          The event budget or guest count changed after this scenario was created. It cannot be applied; create a fresh proposal.
                        </p>
                      ) : null}
                      {scenario && !stale && proposal.status === "pending" ? (
                        <div className="mt-4 flex flex-wrap gap-3">
                          <form action={approveAndApplyScenario.bind(null, event.id, proposal.id)}>
                            <button type="submit" className="rounded-xl bg-emerald-800 px-4 py-2.5 font-semibold text-white">
                              Approve and apply
                            </button>
                          </form>
                          <form action={rejectScenarioProposal.bind(null, event.id, proposal.id)}>
                            <button type="submit" className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 font-semibold text-stone-700">
                              Reject
                            </button>
                          </form>
                        </div>
                      ) : null}
                      {scenario && proposal.status === "approved" ? (
                        <p className="mt-3 text-sm text-emerald-800">
                          Applied: {formatCurrency(scenario.proposed.budget, event.currency)} for {scenario.proposed.guestCount} guests.
                        </p>
                      ) : null}
                      {proposal.kind === "what-if-scenario" && !scenario ? (
                        <p role="alert" className="mt-3 text-sm text-red-700">This saved scenario is invalid and cannot be applied.</p>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

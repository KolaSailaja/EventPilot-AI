import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { calculateBudgetSummary } from "@/lib/budget";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const events = await prisma.event.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      expenses: true,
      tasks: true,
      guests: { include: { rsvp: true } },
      vendors: { include: { quotations: true } },
    },
  });

  const totalBudget = events.reduce((sum, event) => sum + Number(event.budget || 0), 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
      <header className="mb-8 surface-strong rounded-[28px] p-6 lg:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="eyebrow">Dashboard</p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.05em] text-stone-900 md:text-4xl">Your event workspace</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/account" className="rounded-full border border-stone-300 bg-white/70 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400">
              Account
            </Link>
            <Link href="/events/new" className="brand-emerald rounded-full px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:translate-y-[-1px]">
              New event
            </Link>
          </div>
        </div>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="surface rounded-[24px] p-5">
          <p className="eyebrow">Saved events</p>
          <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-stone-900">{events.length}</p>
        </div>
        <div className="surface rounded-[24px] p-5">
          <p className="eyebrow">Combined budget</p>
          <p className="mt-3 text-3xl font-black tracking-[-0.05em] text-stone-900">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="surface rounded-[24px] p-5">
          <p className="eyebrow">Planning mode</p>
          <p className="mt-3 text-2xl font-black tracking-[-0.04em] text-stone-900">Adaptive</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {events.length === 0 ? (
          <div className="surface col-span-full rounded-[30px] p-8 text-center">
            <h2 className="text-3xl font-black tracking-[-0.05em] text-stone-900">No events yet</h2>
            <p className="mt-3 max-w-xl mx-auto text-stone-600">Create your first event to start managing the guest list, real spend, vendor planning, and decision review in one workspace.</p>
            <Link href="/events/new" className="brand-emerald mt-6 inline-flex rounded-full px-5 py-3 text-sm font-bold text-white">
              Create event
            </Link>
          </div>
        ) : (
          events.map((event) => {
            const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);

            return (
              <Link key={event.id} href={`/events/${event.id}`} className="surface block rounded-[30px] p-5 transition hover:-translate-y-0.5 hover:border-emerald-200">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <p className="eyebrow">{event.type}</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-stone-900">{event.name}</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-700">
                    {event.guestCount} guests
                  </span>
                </div>

                <p className="text-sm text-stone-600">{event.location || "Location not set"}</p>

                <div className="mt-5 space-y-3 text-sm text-stone-600">
                  <div className="flex justify-between"><span>Budget</span><strong className="font-bold text-stone-900">{formatCurrency(Number(event.budget || 0), event.currency)}</strong></div>
                  <div className="flex justify-between"><span>Spent</span><strong className="font-bold text-stone-900">{formatCurrency(budgetSummary.actual, event.currency)}</strong></div>
                  <div className="flex justify-between"><span>Remaining</span><strong className={budgetSummary.remaining < 0 ? "font-bold text-red-600" : "font-bold text-stone-900"}>{formatCurrency(budgetSummary.remaining, event.currency)}</strong></div>
                  <div className="flex justify-between"><span>Tasks</span><strong className="font-bold text-stone-900">{event.tasks.length}</strong></div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}

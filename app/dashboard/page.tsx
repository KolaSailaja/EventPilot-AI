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
    <main className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-stone-500">Dashboard</p>
          <h1 className="mt-2 text-3xl font-black text-stone-900">Your event workspace</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/account" className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700">
            Account
          </Link>
          <Link href="/events/new" className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-amber-700">
            New event
          </Link>
        </div>
      </header>

      <section className="mb-8 grid gap-4 md:grid-cols-3">
        <div className="card rounded-2xl p-5">
          <p className="text-sm text-stone-500">Saved events</p>
          <p className="mt-3 text-3xl font-black text-stone-900">{events.length}</p>
        </div>
        <div className="card rounded-2xl p-5">
          <p className="text-sm text-stone-500">Combined budget</p>
          <p className="mt-3 text-3xl font-black text-stone-900">{formatCurrency(totalBudget)}</p>
        </div>
        <div className="card rounded-2xl p-5">
          <p className="text-sm text-stone-500">Planning mode</p>
          <p className="mt-3 text-3xl font-black text-stone-900">Template guidance</p>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {events.length === 0 ? (
          <div className="card col-span-full rounded-3xl p-8 text-center">
            <h2 className="text-2xl font-bold text-stone-900">No events yet</h2>
            <p className="mt-3 text-stone-600">Create your first event to start managing the guest list, budget, vendors, and timeline.</p>
            <Link href="/events/new" className="mt-6 inline-flex rounded-full bg-amber-600 px-5 py-3 font-medium text-white">
              Create event
            </Link>
          </div>
        ) : (
          events.map((event) => {
            const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);

            return (
              <Link key={event.id} href={`/events/${event.id}`} className="card block rounded-3xl p-5 transition hover:-translate-y-0.5">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-stone-500">{event.type}</p>
                    <h2 className="mt-2 text-2xl font-bold text-stone-900">{event.name}</h2>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">{event.guestCount} guests</span>
                </div>

                <p className="text-sm text-stone-600">{event.location || "Location not set"}</p>

                <div className="mt-5 space-y-3 text-sm text-stone-600">
                  <div className="flex justify-between"><span>Budget</span><strong className="text-stone-900">{formatCurrency(Number(event.budget || 0), event.currency)}</strong></div>
                  <div className="flex justify-between"><span>Spent</span><strong className="text-stone-900">{formatCurrency(budgetSummary.actual, event.currency)}</strong></div>
                  <div className="flex justify-between"><span>Remaining</span><strong className={budgetSummary.remaining < 0 ? "text-red-600" : "text-stone-900"}>{formatCurrency(budgetSummary.remaining, event.currency)}</strong></div>
                  <div className="flex justify-between"><span>Tasks</span><strong className="text-stone-900">{event.tasks.length}</strong></div>
                </div>
              </Link>
            );
          })
        )}
      </section>
    </main>
  );
}

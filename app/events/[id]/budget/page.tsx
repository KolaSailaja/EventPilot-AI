import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { BudgetGenerator } from "@/components/budget-generator";
import { EventShell } from "@/components/event-shell";
import { calculateBudgetSummary } from "@/lib/budget";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { categories: true, expenses: true },
  });

  if (!event || event.userId !== session.user.id) notFound();

  const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <BudgetGenerator
          mode="saved"
          aiConfigured={Boolean(process.env.OPENAI_API_KEY)}
          eventId={event.id}
          profile={{
            eventType: event.type,
            location: event.location ?? "",
            guestCount: event.guestCount,
            budget: Number(event.budget),
            currency: event.currency,
            date: event.date?.toISOString().slice(0, 10) ?? "",
            categories: event.categories.map((category) => ({
              name: category.name,
              allocation: Number(category.allocation),
              notes: category.notes,
              isContingency: category.isContingency,
            })),
          }}
        />

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="card rounded-3xl p-5"><p className="text-sm text-stone-500">Total budget</p><p className="mt-3 text-3xl font-bold">{formatCurrency(Number(event.budget || 0), event.currency)}</p></div>
          <div className="card rounded-3xl p-5"><p className="text-sm text-stone-500">Actual spend</p><p className="mt-3 text-3xl font-bold">{formatCurrency(budgetSummary.actual, event.currency)}</p></div>
          <div className="card rounded-3xl p-5"><p className="text-sm text-stone-500">Planned expenses</p><p className="mt-3 text-3xl font-bold">{formatCurrency(budgetSummary.planned, event.currency)}</p></div>
          <div className="card rounded-3xl p-5"><p className="text-sm text-stone-500">Remaining</p><p className={`mt-3 text-3xl font-bold ${budgetSummary.remaining < 0 ? "text-red-600" : "text-stone-900"}`}>{formatCurrency(budgetSummary.remaining, event.currency)}</p></div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <section className="card rounded-3xl p-6">
            <h2 className="text-xl font-bold text-stone-900">Category allocations</h2>
            <div className="mt-5 space-y-3">
              {event.categories.map((category) => (
                <div key={category.id} className="rounded-2xl border border-stone-200 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-700">{category.name}</span>
                    <span className="text-sm font-semibold">{formatCurrency(Number(category.allocation), event.currency)}</span>
                  </div>
                  {category.notes && (
                    <p className="mt-2 whitespace-pre-line text-xs leading-5 text-stone-500">{category.notes}</p>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="card rounded-3xl p-6">
            <h2 className="text-xl font-bold text-stone-900">Expense ledger</h2>
            <div className="mt-5 space-y-3">
              {event.expenses.length === 0 ? (
                <p className="text-stone-600">No expenses yet.</p>
              ) : (
                event.expenses.map((expense) => (
                  <div key={expense.id} className="flex items-center justify-between rounded-2xl border border-stone-200 p-3 text-sm">
                    <div>
                      <p className="font-medium text-stone-800">{expense.title}</p>
                      <p className="text-stone-500">{expense.isActual ? "Actual" : "Planned"}</p>
                    </div>
                    <span className="font-semibold text-stone-900">{formatCurrency(Number(expense.amount), event.currency)}</span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

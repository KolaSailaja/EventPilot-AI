import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { PrintButton } from "@/components/print-button";
import { calculateBudgetSummary } from "@/lib/budget";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function ExportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      guests: { include: { rsvp: true }, orderBy: { name: "asc" } },
      tasks: { orderBy: { dueDate: "asc" } },
      vendors: { include: { quotations: true }, orderBy: { name: "asc" } },
      expenses: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!event || event.userId !== session.user.id) notFound();

  const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-5xl px-4 pb-10">
        <div className="card rounded-[28px] p-8">
          <div className="flex items-center justify-between gap-4 border-b border-stone-200 pb-4">
            <div>
              <p className="text-sm uppercase tracking-[0.18em] text-stone-500">Event export</p>
              <h2 className="mt-2 text-3xl font-black text-stone-900">{event.name}</h2>
            </div>
            <PrintButton />
          </div>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-stone-500">Event type</p>
              <p className="mt-2 font-semibold text-stone-900">{event.type}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500">Date</p>
              <p className="mt-2 font-semibold text-stone-900">{event.date ? new Date(event.date).toLocaleDateString() : "Not scheduled"}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500">Location</p>
              <p className="mt-2 font-semibold text-stone-900">{event.location || "Not set"}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500">Budget</p>
              <p className="mt-2 font-semibold text-stone-900">{formatCurrency(Number(event.budget || 0), event.currency)}</p>
            </div>
            <div>
              <p className="text-sm text-stone-500">Actual spend</p>
              <p className="mt-2 font-semibold text-stone-900">{formatCurrency(budgetSummary.actual, event.currency)}</p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="text-lg font-bold text-stone-900">Guest summary</h3>
              <p className="mt-2 text-stone-700">{event.guests.length} guests tracked</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-700">
                {event.guests.map((guest) => (
                  <li key={guest.id} className="flex justify-between gap-4 border-b border-stone-200 py-2">
                    <span>{guest.name}</span>
                    <span>{guest.rsvp?.status || "pending"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">Task summary</h3>
              <p className="mt-2 text-stone-700">{event.tasks.length} tasks planned</p>
              <ul className="mt-3 space-y-2 text-sm text-stone-700">
                {event.tasks.map((task) => (
                  <li key={task.id} className="border-b border-stone-200 py-2">
                    <div className="flex justify-between gap-4">
                      <span>{task.title}</span>
                      <span>{task.status}</span>
                    </div>
                    <p className="mt-1 text-stone-500">
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No due date"} · {task.priority} priority
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <section className="mt-8">
            <h3 className="text-lg font-bold text-stone-900">Vendors and quotations</h3>
            {event.vendors.length === 0 ? (
              <p className="mt-2 text-sm text-stone-600">No vendors are recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-stone-700">
                {event.vendors.map((vendor) => (
                  <li key={vendor.id} className="flex flex-wrap justify-between gap-2 border-b border-stone-200 py-2">
                    <span>{vendor.name} · {vendor.category} · {vendor.status}</span>
                    <span>
                      {vendor.quotations.map((quote) =>
                        `${quote.isConfirmed ? "Confirmed" : "Estimate"}: ${formatCurrency(Number(quote.amount), quote.currency)}`,
                      ).join(" · ") || "No quotes"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <h3 className="text-lg font-bold text-stone-900">Expense ledger</h3>
            {event.expenses.length === 0 ? (
              <p className="mt-2 text-sm text-stone-600">No expenses are recorded.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-stone-700">
                {event.expenses.map((expense) => (
                  <li key={expense.id} className="flex justify-between gap-4 border-b border-stone-200 py-2">
                    <span>{expense.title} · {expense.isActual ? "Actual" : "Planned"}</span>
                    <span>{formatCurrency(Number(expense.amount), event.currency)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { EventWhatIfSimulator } from "@/components/what-if-simulator";
import { calculateBudgetSummary } from "@/lib/budget";
import prisma from "@/lib/prisma";
import { addExpense, addGuest, addTask, addVendor } from "@/lib/event-actions";
import { formatCurrency } from "@/lib/utils";

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      expenses: true,
      tasks: { orderBy: { dueDate: "asc" } },
      guests: { include: { rsvp: true } },
      vendors: { include: { quotations: true } },
      categories: true,
      planSections: { orderBy: { generatedAt: "desc" }, take: 2 },
    },
  });

  if (!event || event.userId !== session.user.id) {
    notFound();
  }

  const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);
  return (
    <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
      <EventShell eventId={event.id} eventName={event.name} />

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <section className="surface rounded-[30px] p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="eyebrow">Overview</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-stone-900">{event.name}</h2>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800">{event.type}</span>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-sm text-stone-500">Budget</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-stone-900">{formatCurrency(Number(event.budget || 0), event.currency)}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-sm text-stone-500">Spent</p>
                <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-stone-900">{formatCurrency(budgetSummary.actual, event.currency)}</p>
              </div>
              <div className="rounded-2xl bg-stone-50 p-4">
                <p className="text-sm text-stone-500">Remaining</p>
                <p className={`mt-2 text-2xl font-black tracking-[-0.04em] ${budgetSummary.remaining < 0 ? "text-red-600" : "text-stone-900"}`}>
                  {formatCurrency(budgetSummary.remaining, event.currency)}
                </p>
              </div>
            </div>
          </section>

          <EventWhatIfSimulator
            eventId={event.id}
            currentBudget={Number(event.budget || 0)}
            currentGuestCount={event.guestCount}
            actualSpend={budgetSummary.actual}
            currency={event.currency}
            eventType={event.type}
          />

          <section className="surface rounded-[30px] p-6">
            <h3 className="text-2xl font-black tracking-[-0.05em] text-stone-900">Latest planning notes</h3>
            {event.planSections.length === 0 ? (
              <p className="mt-4 text-stone-600">No saved planning notes yet. Open the planning studio to create one.</p>
            ) : (
              <div className="mt-4 space-y-4">
                {event.planSections.map((section) => (
                  <div key={section.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-sm font-semibold uppercase tracking-[0.14em] text-stone-500">{section.title}</p>
                    <p className="mt-2 text-stone-700">{section.content}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="surface rounded-[30px] p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-black tracking-[-0.05em] text-stone-900">Expense capture</h3>
            </div>
            <form action={addExpense.bind(null, event.id)} className="mt-5 grid gap-3 md:grid-cols-4">
              <input name="title" aria-label="Expense title" placeholder="Expense title" className="field-input" required />
              <input name="amount" aria-label="Expense amount" type="number" min={0} step="0.01" placeholder="Amount" className="field-input" required />
              <select name="categoryId" aria-label="Budget category" className="field-input">
                <option value="">General</option>
                {event.categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <label className="flex items-center gap-2 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm font-medium text-stone-700">
                <input type="checkbox" name="isActual" /> Actual spend
              </label>
              <input name="notes" aria-label="Expense notes" placeholder="Notes" className="field-input md:col-span-4" />
              <button type="submit" className="brand-emerald rounded-xl px-4 py-3 text-sm font-bold text-white md:col-span-4">Add expense</button>
            </form>
          </section>
        </div>

        <aside className="space-y-6">
          <div className="surface rounded-[30px] p-5">
            <h3 className="text-xl font-black tracking-[-0.04em] text-stone-900">Summary</h3>
            <dl className="mt-4 space-y-3 text-sm text-stone-600">
              <div className="flex justify-between"><dt>Guest count</dt><dd className="font-bold text-stone-900">{event.guestCount}</dd></div>
              <div className="flex justify-between"><dt>Location</dt><dd className="font-bold text-stone-900">{event.location || "Add location"}</dd></div>
              <div className="flex justify-between"><dt>Date</dt><dd className="font-bold text-stone-900">{event.date ? new Date(event.date).toLocaleDateString() : "No date"}</dd></div>
              <div className="flex justify-between"><dt>Tasks</dt><dd className="font-bold text-stone-900">{event.tasks.length}</dd></div>
              <div className="flex justify-between"><dt>Vendors</dt><dd className="font-bold text-stone-900">{event.vendors.length}</dd></div>
            </dl>
          </div>

          <div className="surface rounded-[30px] p-5">
            <h3 className="text-xl font-black tracking-[-0.04em] text-stone-900">Quick add</h3>
            <div className="mt-4 space-y-4">
              <form action={addTask.bind(null, event.id)} className="space-y-3">
                <input name="title" aria-label="Task title" placeholder="Task title" className="field-input" required />
                <input name="dueDate" aria-label="Task due date" type="date" className="field-input" />
                <button type="submit" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-semibold text-stone-700">Add task</button>
              </form>

              <form action={addGuest.bind(null, event.id)} className="space-y-3">
                <input name="name" aria-label="Guest name" placeholder="Guest name" className="field-input" required />
                <input name="email" aria-label="Guest email" type="email" placeholder="Guest email" className="field-input" />
                <button type="submit" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-semibold text-stone-700">Add guest</button>
              </form>

              <form action={addVendor.bind(null, event.id)} className="space-y-3">
                <input name="name" aria-label="Vendor name" placeholder="Vendor name" className="field-input" required />
                <input name="category" aria-label="Vendor category" placeholder="Category" className="field-input" required />
                <input name="amount" aria-label="Vendor quote amount" type="number" min={0} step="0.01" placeholder="Quote amount" className="field-input" />
                <button type="submit" className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 font-semibold text-stone-700">Add vendor</button>
              </form>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { addTask, updateTaskStatus } from "@/lib/event-actions";
import { calculateBudgetSummary } from "@/lib/budget";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      tasks: { orderBy: { dueDate: "asc" } },
      expenses: true,
      guests: { include: { rsvp: true } },
      vendors: { include: { quotations: true } },
    },
  });

  if (!event || event.userId !== session.user.id) notFound();

  const now = new Date();
  const budgetSummary = calculateBudgetSummary(event.budget, event.expenses);
  const overdueTasks = event.tasks.filter((task) => task.dueDate && new Date(task.dueDate) < now && task.status !== "done");
  const dueSoonTasks = event.tasks.filter((task) => {
    if (!task.dueDate || task.status === "done") return false;
    const diffInDays = Math.ceil((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diffInDays >= 0 && diffInDays <= 7;
  });
  const pendingGuestResponses = event.guests.filter((guest) => !guest.rsvp || guest.rsvp.status === "pending");
  const vendorFollowUps = event.vendors.filter((vendor) => {
    const latestQuote = vendor.quotations[0];
    return vendor.status !== "booked" || (latestQuote && !latestQuote.isConfirmed);
  });

  return (
    <main className="mx-auto max-w-7xl px-4 pb-10 pt-6">
      <EventShell eventId={event.id} eventName={event.name} />

      <section className="surface rounded-[30px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="eyebrow">Event-day command center</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.05em] text-stone-900">Run-of-show and live readiness</h2>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-stone-600">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Based on saved event data
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-sm text-stone-500">Tasks due soon</p>
            <p className="mt-2 text-2xl font-black text-stone-900">{dueSoonTasks.length}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-sm text-stone-500">Overdue</p>
            <p className="mt-2 text-2xl font-black text-red-600">{overdueTasks.length}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-sm text-stone-500">Budget status</p>
            <p className="mt-2 text-lg font-black text-stone-900">{formatCurrency(budgetSummary.remaining, event.currency)}</p>
          </div>
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-sm text-stone-500">Guest follow-up</p>
            <p className="mt-2 text-2xl font-black text-stone-900">{pendingGuestResponses.length}</p>
          </div>
        </div>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <section className="surface rounded-[30px] p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-black tracking-[-0.05em] text-stone-900">Run-of-show</h3>
            <span className="text-sm text-stone-500">{event.tasks.length} task{event.tasks.length === 1 ? "" : "s"}</span>
          </div>

          <div className="mt-6 space-y-4">
            {event.tasks.length === 0 ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 p-5 text-stone-600">No tasks saved yet. Add the first step below.</div>
            ) : (
              event.tasks.map((task) => {
                const isOverdue = Boolean(task.dueDate && new Date(task.dueDate) < now && task.status !== "done");
                const isDueSoon = Boolean(task.dueDate && !isOverdue && task.status !== "done" && Math.ceil((new Date(task.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 7);

                return (
                  <div key={task.id} className="rounded-2xl border border-stone-200 bg-white p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-bold text-stone-900">{task.title}</p>
                        {task.description ? <p className="mt-1 text-sm text-stone-600">{task.description}</p> : null}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs text-stone-600">
                          <span className="rounded-full bg-stone-100 px-2 py-1">{task.priority}</span>
                          {isOverdue ? <span className="rounded-full bg-red-100 px-2 py-1 text-red-700">Overdue</span> : null}
                          {isDueSoon ? <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">Due soon</span> : null}
                        </div>
                      </div>

                      <form action={updateTaskStatus.bind(null, event.id, task.id)} className="flex items-center gap-2">
                        <select name="status" defaultValue={task.status} className="field-input min-w-[140px] rounded-lg border border-stone-200 bg-stone-50 px-2 py-2 text-sm">
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="done">Done</option>
                          <option value="blocked">Blocked</option>
                        </select>
                        <button type="submit" className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm font-semibold text-stone-700">Update</button>
                      </form>
                    </div>

                    <div className="mt-3 text-sm text-stone-600">
                      <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Flexible"}</span>
                      <span className="mx-2">•</span>
                      <span>Status: {task.status}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="surface rounded-[30px] p-5">
            <h3 className="text-xl font-black tracking-[-0.04em] text-stone-900">Add a task</h3>
            <form action={addTask.bind(null, event.id)} className="mt-4 space-y-3">
              <input name="title" aria-label="Task title" placeholder="Task title" required className="field-input" />
              <input name="description" aria-label="Task description" placeholder="Description" className="field-input" />
              <input name="dueDate" aria-label="Task due date" type="date" className="field-input" />
              <select name="priority" aria-label="Task priority" className="field-input">
                <option value="high">High</option>
                <option value="medium" selected>Medium</option>
                <option value="low">Low</option>
              </select>
              <button type="submit" className="w-full rounded-xl bg-stone-900 px-4 py-2.5 font-medium text-white">Add task</button>
            </form>
          </div>

          <div className="surface rounded-[30px] p-5">
            <h3 className="text-xl font-black tracking-[-0.04em] text-stone-900">Attention needed</h3>
            <div className="mt-4 space-y-3 text-sm text-stone-700">
              {pendingGuestResponses.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800">Guest responses</p>
                  <p className="mt-1">{pendingGuestResponses.length} guest{pendingGuestResponses.length === 1 ? "" : "s"} still need a response or follow-up.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">Guest responses look steady.</div>
              )}

              {vendorFollowUps.length > 0 ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                  <p className="font-semibold text-amber-800">Vendor follow-up</p>
                  <p className="mt-1">{vendorFollowUps.length} vendor record{vendorFollowUps.length === 1 ? "" : "s"} still need confirmation or follow-up.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">Vendor confirmations are current.</div>
              )}

              {budgetSummary.remaining < 0 ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700">
                  <p className="font-semibold">Budget alert</p>
                  <p className="mt-1">Actual spend is above the saved budget target by {formatCurrency(Math.abs(budgetSummary.remaining), event.currency)}.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-800">Budget remains within the planned target.</div>
              )}
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

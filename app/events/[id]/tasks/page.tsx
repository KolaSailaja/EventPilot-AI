import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { addTask } from "@/lib/event-actions";
import prisma from "@/lib/prisma";

export default async function TasksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { tasks: { orderBy: { dueDate: "asc" } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="card rounded-3xl p-6">
          <h2 className="text-xl font-bold text-stone-900">Timeline and tasks</h2>
          <form action={addTask.bind(null, event.id)} className="mt-5 grid gap-3 md:grid-cols-4">
            <input name="title" aria-label="Task title" placeholder="Task title" required className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="description" aria-label="Task description" placeholder="Description" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="dueDate" aria-label="Task due date" type="date" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <select name="priority" aria-label="Task priority" className="rounded-xl border border-stone-300 px-3 py-2.5">
              <option value="high">High</option>
              <option value="medium" selected>Medium</option>
              <option value="low">Low</option>
            </select>
            <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2.5 font-medium text-white md:col-span-4">Add task</button>
          </form>
        </div>

        <div className="mt-8 space-y-4">
          {event.tasks.length === 0 ? (
            <div className="card rounded-3xl p-6 text-stone-600">No tasks saved yet.</div>
          ) : (
            event.tasks.map((task) => (
              <div key={task.id} className="card rounded-3xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-stone-900">{task.title}</p>
                    {task.description && <p className="mt-2 text-sm text-stone-600">{task.description}</p>}
                  </div>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-amber-800">{task.priority}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-stone-600">
                  <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "Flexible"}</span>
                  <span>Status: {task.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

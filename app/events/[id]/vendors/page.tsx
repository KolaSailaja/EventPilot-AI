import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { EventShell } from "@/components/event-shell";
import { addVendor, deleteVendor } from "@/lib/event-actions";
import prisma from "@/lib/prisma";
import { formatCurrency } from "@/lib/utils";

export default async function VendorsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) redirect("/sign-in");

  const event = await prisma.event.findUnique({
    where: { id },
    include: { vendors: { include: { quotations: true } } },
  });

  if (!event || event.userId !== session.user.id) notFound();

  return (
    <main>
      <EventShell eventId={event.id} eventName={event.name} />
      <div className="mx-auto max-w-7xl px-4 pb-10">
        <div className="card rounded-3xl p-6">
          <h2 className="text-xl font-bold text-stone-900">Vendor workspace</h2>
          <form action={addVendor.bind(null, event.id)} className="mt-5 grid gap-3 md:grid-cols-3">
            <input name="name" aria-label="Vendor name" placeholder="Vendor name" required className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="category" aria-label="Vendor category" placeholder="Category" required className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="contact" aria-label="Vendor contact" placeholder="Contact" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <input name="amount" aria-label="Quote amount" type="number" min={0} step="0.01" placeholder="Quote amount" className="rounded-xl border border-stone-300 px-3 py-2.5" />
            <select name="status" aria-label="Vendor status" className="rounded-xl border border-stone-300 px-3 py-2.5">
              <option value="prospect">Prospect</option>
              <option value="quoted">Quoted</option>
              <option value="booked">Booked</option>
              <option value="rejected">Rejected</option>
            </select>
            <label className="flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2.5 text-sm text-stone-700">
              <input type="checkbox" name="isConfirmed" /> Confirmed
            </label>
            <button type="submit" className="rounded-xl bg-stone-900 px-4 py-2.5 font-medium text-white md:col-span-3">Save vendor</button>
          </form>
        </div>

        <div className="mt-8 space-y-4">
          {event.vendors.length === 0 ? (
            <div className="card rounded-3xl p-6 text-stone-600">No vendors added yet.</div>
          ) : (
            event.vendors.map((vendor) => (
              <div key={vendor.id} className="card rounded-3xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-stone-900">{vendor.name}</p>
                    <p className="text-sm text-stone-500">{vendor.category}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.12em] text-stone-700">{vendor.status}</span>
                    <form action={deleteVendor.bind(null, event.id, vendor.id)}>
                      <button type="submit" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">Delete</button>
                    </form>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-sm text-stone-600">
                  {vendor.quotations.map((quote) => (
                    <div key={quote.id} className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
                      <span>{quote.isConfirmed ? "Confirmed quote" : "Estimate"}</span>
                      <strong className="text-stone-900">{formatCurrency(Number(quote.amount), quote.currency)}</strong>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

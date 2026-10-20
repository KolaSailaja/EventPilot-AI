import Link from "next/link";

export function EventShell({ eventId, eventName }: { eventId: string; eventName: string }) {
  const tabs = [
    { href: `/events/${eventId}`, label: "Overview" },
    { href: `/events/${eventId}/budget`, label: "Budget" },
    { href: `/events/${eventId}/tasks`, label: "Timeline" },
    { href: `/events/${eventId}/vendors`, label: "Vendors" },
    { href: `/events/${eventId}/guests`, label: "Guests" },
    { href: `/events/${eventId}/ai`, label: "AI Studio" },
    { href: `/events/${eventId}/impact`, label: "Impact" },
    { href: `/events/${eventId}/export`, label: "Export" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 print:hidden">
      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-stone-500">Event</p>
          <h1 className="text-2xl font-bold text-stone-900">{eventName}</h1>
        </div>
        <Link href="/dashboard" className="text-sm font-medium text-stone-700 hover:text-stone-900">
          ← Back to dashboard
        </Link>
      </div>

      <nav className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-2 shadow-sm">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-xl px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

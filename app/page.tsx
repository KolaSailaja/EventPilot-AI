import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen text-stone-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <div className="brand-emerald flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black tracking-[0.12em] text-white shadow-lg shadow-emerald-900/15">
            EP
          </div>
          <div>
            <p className="text-lg font-black tracking-tight">EventPilot AI</p>
          </div>
        </Link>
        <nav className="flex items-center gap-3 text-sm font-semibold text-stone-700">
          <Link href="/sign-in" className="rounded-full px-3 py-2 transition hover:bg-stone-100">Sign in</Link>
          <Link href="/sign-up" className="rounded-full bg-stone-900 px-4 py-2.5 text-white transition hover:bg-stone-700">
            Create event
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pb-16 pt-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8 lg:pt-12">
        <div>
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-800">
            From inspiration to a plan that works
          </span>
          <h1 className="mt-5 max-w-xl text-5xl font-black tracking-[-0.06em] text-stone-900 lg:text-6xl">
            Design a memorable event. Keep every decision grounded in reality.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
            EventPilot AI brings together the creative brief, budget reality, guest logistics, vendor planning, and proposal reviews so your next celebration feels elevated instead of chaotic.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/sign-up" className="rounded-full brand-emerald px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-900/10 transition hover:translate-y-[-1px]">
              Start planning
            </Link>
            <Link href="/sign-in" className="rounded-full border border-stone-300 bg-white/80 px-6 py-3 text-sm font-bold text-stone-700 transition hover:border-stone-400">
              Explore workspace
            </Link>
          </div>

          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 text-left">
            <div className="surface rounded-2xl p-4">
              <p className="text-2xl font-black text-stone-900">6+</p>
              <p className="mt-1 text-sm text-stone-600">event types</p>
            </div>
            <div className="surface rounded-2xl p-4">
              <p className="text-2xl font-black text-stone-900">₹4.2L</p>
              <p className="mt-1 text-sm text-stone-600">budget clarity</p>
            </div>
            <div className="surface rounded-2xl p-4">
              <p className="text-2xl font-black text-stone-900">AI</p>
              <p className="mt-1 text-sm text-stone-600">with review gates</p>
            </div>
          </div>
        </div>

        <div className="surface rounded-[30px] p-5 sm:p-6">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">June 2027</p>
                <p className="mt-2 text-xl font-black text-stone-900">Spring Gala</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">
                On track
              </span>
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5">
              <p className="text-sm text-stone-500">Budget summary</p>
              <div className="mt-4 flex items-end justify-between gap-4">
                <p className="text-4xl font-black tracking-[-0.05em] text-stone-900">₹4.2L</p>
                <p className="text-sm font-bold text-emerald-700">₹1.1L remaining</p>
              </div>
              <div className="mt-4 h-2 rounded-full bg-stone-200">
                <div className="h-full w-[72%] rounded-full bg-gradient-to-r from-emerald-500 to-amber-400" />
              </div>
            </div>

            <div className="space-y-3 text-sm text-stone-600">
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-3">
                <span>Guest count</span>
                <strong className="font-bold text-stone-900">220</strong>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-3">
                <span>Vendor quotes</span>
                <strong className="font-bold text-stone-900">4 confirmed</strong>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-stone-50 p-3">
                <span>Task risk</span>
                <strong className="font-bold text-amber-700">2 deadlines</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-8">
        <div className="mb-8 max-w-xl">
          <p className="eyebrow">Why teams choose EventPilot AI</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-stone-900">Built for the planning decisions that actually matter.</h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {[
            ["Event vision", "Capture mood, guest profile, venue constraints, and budget posture before the project becomes noisy."],
            ["Budget confidence", "See actual spend, category allocations, and what changes when a vendor quote or guest count shifts."],
            ["Decision review", "Review scenario changes before they touch the event record and keep behind-the-scenes approvals transparent."],
          ].map(([title, text]) => (
            <article key={title} className="surface rounded-[24px] p-5">
              <div className="mb-4 h-10 w-10 rounded-2xl bg-emerald-50 text-lg font-black text-emerald-800 flex items-center justify-center">•</div>
              <h3 className="text-xl font-black text-stone-900">{title}</h3>
              <p className="mt-3 text-base leading-7 text-stone-600">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-8">
        <div className="surface-strong rounded-[32px] p-8 lg:p-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <p className="eyebrow">Plan impact engine</p>
              <h3 className="mt-3 text-4xl font-black tracking-[-0.05em] text-stone-900">Turn change into a clear recommendation, not chaos.</h3>
              <p className="mt-4 max-w-xl text-base leading-7 text-stone-600">
                Preview guest growth, budget pressure, and vendor changes before applying anything. The app keeps the calculation deterministic and the recommendation reviewable by the event owner.
              </p>
            </div>

            <div className="rounded-[28px] border border-stone-200 bg-stone-50 p-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-2xl bg-white p-3">
                  <span className="text-sm text-stone-600">Current plan</span>
                  <span className="font-bold text-stone-900">₹4.2L</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white p-3">
                  <span className="text-sm text-stone-600">Proposal</span>
                  <span className="font-bold text-amber-700">₹4.8L</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-white p-3">
                  <span className="text-sm text-stone-600">Trade-offs</span>
                  <span className="font-bold text-emerald-700">Reduce decor scope</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">For every celebration</p>
            <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-stone-900">Flexible enough for the moments that matter.</h2>
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Weddings & engagement celebrations",
            "Birthdays & anniversaries",
            "College events & fests",
            "Festivals & community gatherings",
          ].map((label) => (
            <div key={label} className="surface rounded-[24px] p-5 text-stone-800">
              <div className="mb-4 h-10 w-10 rounded-2xl bg-amber-50 text-lg font-black text-amber-800 flex items-center justify-center">✦</div>
              <p className="text-lg font-bold">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-stone-600 md:flex-row md:items-center md:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-emerald flex h-9 w-9 items-center justify-center rounded-xl text-sm font-black text-white">EP</div>
            <span>EventPilot AI</span>
          </div>
          <p>Planning clarity for memorable events.</p>
        </div>
      </footer>
    </main>
  );
}

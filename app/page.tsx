import Link from "next/link";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-lg font-bold text-white shadow-sm">
            EP
          </div>
          <div>
            <p className="text-lg font-semibold">EventPilot AI</p>
          </div>
        </div>
        <nav className="flex items-center gap-4 text-sm font-medium text-stone-700">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/sign-up" className="rounded-full bg-stone-900 px-4 py-2 text-white">
            Create event
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-6 py-16 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800">
            Adaptive planning workspace
          </span>
          <h1 className="mt-5 max-w-xl text-5xl font-black tracking-tight text-stone-900">
            Plan every event with budget, guest, and timeline in sync.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-stone-600">
            EventPilot AI helps couples, families, and organizers turn ideas into a coordinated plan with AI suggestions, approvals, and impact-aware change reviews.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/sign-up" className="rounded-full bg-amber-600 px-6 py-3 font-medium text-white shadow-sm transition hover:bg-amber-700">
              Start planning
            </Link>
            <Link href="/sign-in" className="rounded-full border border-stone-300 bg-white px-6 py-3 font-medium text-stone-700 transition hover:border-stone-400">
              View demo dashboard
            </Link>
          </div>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4 text-left">
            <div className="rounded-2xl border border-stone-200 bg-white/80 p-3">
              <p className="text-2xl font-bold text-stone-900">6+</p>
              <p className="text-sm text-stone-600">event types</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 p-3">
              <p className="text-2xl font-bold text-stone-900">3x</p>
              <p className="text-sm text-stone-600">faster coordination</p>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white/80 p-3">
              <p className="text-2xl font-bold text-stone-900">AI</p>
              <p className="text-sm text-stone-600">with review gates</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-6 shadow-[0_18px_45px_rgba(120,113,108,0.12)]">
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-stone-500">Wedding event</span>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">On track</span>
            </div>
            <div className="rounded-2xl bg-stone-100 p-4">
              <p className="text-sm text-stone-500">Budget summary</p>
              <div className="mt-2 flex items-end justify-between">
                <p className="text-3xl font-bold text-stone-900">₹4.2L</p>
                <p className="text-sm font-medium text-emerald-600">₹1.1L remaining</p>
              </div>
            </div>
            <div className="space-y-3 text-sm text-stone-600">
              <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
                <span>Guest count</span>
                <strong className="font-semibold text-stone-900">220</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
                <span>Vendor quotes</span>
                <strong className="font-semibold text-stone-900">4 confirmed</strong>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
                <span>Task risk</span>
                <strong className="font-semibold text-amber-700">2 deadlines at risk</strong>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

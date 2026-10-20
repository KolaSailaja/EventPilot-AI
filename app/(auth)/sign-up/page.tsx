"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/register", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Unable to create your account.");
      }

      router.push("/sign-in");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create your account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="card w-full max-w-md rounded-[28px] p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-600 text-lg font-bold text-white">
            EP
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-stone-500">Create account</p>
            <p className="text-xl font-bold text-stone-900">Start planning</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-stone-700">Name</label>
            <input id="name" name="name" type="text" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-stone-700">Email</label>
            <input id="email" name="email" type="email" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-stone-700">Password</label>
            <input id="password" name="password" type="password" minLength={8} required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 outline-none transition focus:border-amber-500" />
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={loading} className="w-full rounded-xl bg-stone-900 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-stone-600">
          Already have an account? <Link href="/sign-in" className="font-semibold text-amber-700">Sign in</Link>
        </p>
      </div>
    </main>
  );
}

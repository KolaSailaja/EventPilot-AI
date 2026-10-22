"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");

    setLoading(true);
    setError(null);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("The email or password is incorrect.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Sign in is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="surface w-full max-w-md rounded-[30px] p-7">
        <div className="mb-6 flex items-center gap-3">
          <div className="brand-emerald flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-black text-white">
            EP
          </div>
          <div>
            <p className="eyebrow">Welcome back</p>
            <p className="text-xl font-black text-stone-900">EventPilot AI</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-block">
              <span>Email</span>
              <input id="email" name="email" type="email" required className="field-input" />
            </label>
          </div>

          <div>
            <label htmlFor="password" className="field-block">
              <span>Password</span>
              <input id="password" name="password" type="password" minLength={8} required className="field-input" />
            </label>
          </div>

          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          <button type="submit" disabled={loading} className="brand-emerald w-full rounded-xl px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-stone-600">
          Need an account? <Link href="/sign-up" className="font-semibold text-emerald-700">Create one</Link>
        </p>
      </div>
    </main>
  );
}

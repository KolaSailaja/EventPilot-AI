import Link from "next/link";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import prisma from "@/lib/prisma";

export default async function AccountPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { events: true },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="card rounded-[28px] p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-stone-500">Account</p>
            <h1 className="mt-2 text-3xl font-black text-stone-900">{user?.name || "Planner profile"}</h1>
          </div>
          <Link href="/dashboard" className="text-sm font-medium text-stone-700">Back to dashboard</Link>
        </div>

        <div className="mt-6 space-y-4 text-stone-700">
          <p><strong>Email:</strong> {user?.email}</p>
          <p><strong>Events saved:</strong> {user?.events.length ?? 0}</p>
        </div>

        <form action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }} className="mt-6">
          <button type="submit" className="rounded-full bg-stone-900 px-5 py-3 font-medium text-white">Sign out</button>
        </form>
      </div>
    </main>
  );
}

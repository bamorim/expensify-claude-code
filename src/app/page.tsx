import Link from "next/link";

import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Expense <span className="text-[hsl(280,100%,70%)]">Manager</span>
          </h1>

          <div className="flex flex-col items-center gap-6">
            <p className="text-center text-2xl text-white">
              {session && <span>Welcome, {session.user?.name}!</span>}
              {!session && <span>Manage your organization expenses</span>}
            </p>

            <div className="flex gap-4">
              <Link
                href={session ? "/api/auth/signout" : "/api/auth/signin"}
                className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
              >
                {session ? "Sign out" : "Sign in"}
              </Link>

              {session && (
                <Link
                  href="/organizations"
                  className="rounded-full bg-white/10 px-10 py-3 font-semibold no-underline transition hover:bg-white/20"
                >
                  My Organizations
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}

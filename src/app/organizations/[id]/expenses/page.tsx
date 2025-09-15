import { ExpenseDashboard } from "~/app/_components/expense-dashboard";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { redirect } from "next/navigation";

interface ExpensePageProps {
  params: { id: string };
}

export default async function ExpensePage({ params }: ExpensePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Prefetch data for hydration
  try {
    await Promise.all([
      api.organization.getById.prefetch({ id: params.id }),
      api.category.list.prefetch({ organizationId: params.id }),
      api.expense.list.prefetch({ organizationId: params.id }),
      api.expense.getStats.prefetch({ organizationId: params.id }),
    ]);
  } catch {
    redirect("/organizations");
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <ExpenseDashboard organizationId={params.id} />
        </div>
      </main>
    </HydrateClient>
  );
}
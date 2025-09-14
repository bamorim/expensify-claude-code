import { OrganizationDetails } from "~/app/_components/organization-details";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { redirect } from "next/navigation";

interface OrganizationPageProps {
  params: { id: string };
}

export default async function OrganizationPage({ params }: OrganizationPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/api/auth/signin");
  }

  // Prefetch organization data server-side for hydration
  try {
    await api.organization.getById.prefetch({ id: params.id });
  } catch {
    redirect("/organizations");
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <OrganizationDetails organizationId={params.id} />
        </div>
      </main>
    </HydrateClient>
  );
}
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";
import { redirect } from "next/navigation";
import { InviteAcceptance } from "~/app/_components/invite-acceptance";

interface InvitePageProps {
  params: { token: string };
}

export default async function InvitePage({ params }: InvitePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect(`/api/auth/signin?callbackUrl=/invite/${params.token}`);
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          <InviteAcceptance token={params.token} />
        </div>
      </main>
    </HydrateClient>
  );
}
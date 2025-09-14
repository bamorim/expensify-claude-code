"use client";

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { useEffect, useState } from "react";

interface InviteAcceptanceProps {
  token: string;
}

export function InviteAcceptance({ token }: InviteAcceptanceProps) {
  const router = useRouter();
  const [hasAttempted, setHasAttempted] = useState(false);

  const acceptInvitation = api.invitation.accept.useMutation({
    onSuccess: (result) => {
      router.push(`/organizations/${result.organization.id}`);
    },
    onError: () => {
      setHasAttempted(true);
    },
  });

  useEffect(() => {
    if (!hasAttempted && !acceptInvitation.isPending) {
      acceptInvitation.mutate({ token });
    }
  }, [hasAttempted, acceptInvitation, token]);

  if (acceptInvitation.isPending) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-white mb-6">Accepting Invitation</h1>
        <div className="rounded-lg bg-white/5 p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-gray-400">Processing your invitation...</p>
        </div>
      </div>
    );
  }

  if (acceptInvitation.error) {
    return (
      <div className="w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-white mb-6">Invitation Error</h1>
        <div className="rounded-lg bg-white/5 p-8">
          <div className="text-red-400 text-6xl mb-4">⚠️</div>
          <p className="text-red-400 mb-4">{acceptInvitation.error.message}</p>
          <div className="space-y-3">
            <button
              onClick={() => router.push("/organizations")}
              className="w-full rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
            >
              Go to Organizations
            </button>
            <button
              onClick={() => {
                setHasAttempted(false);
                acceptInvitation.reset();
              }}
              className="w-full rounded-lg bg-white/5 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md text-center">
      <h1 className="text-3xl font-bold text-white mb-6">Processing Invitation</h1>
      <div className="rounded-lg bg-white/5 p-8">
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function PendingInvitations() {
  const router = useRouter();
  const utils = api.useUtils();

  const { data: invitations, isLoading } = api.invitation.listPendingForUser.useQuery();

  const acceptInvitation = api.invitation.accept.useMutation({
    onSuccess: (result) => {
      void utils.invitation.listPendingForUser.invalidate();
      void utils.organization.list.invalidate();
      router.push(`/organizations/${result.organization.id}`);
    },
  });

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Pending Invitations</h3>
        <p className="text-gray-400">Loading invitations...</p>
      </div>
    );
  }

  if (!invitations || invitations.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Pending Invitations</h3>
      <div className="space-y-4">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="rounded-lg bg-white/5 p-4 border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h4 className="text-white font-medium">{invitation.organization.name}</h4>
                <p className="text-sm text-gray-400">
                  Invited by {invitation.invitedBy.name ?? invitation.invitedBy.email} as {invitation.role}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Expires: {new Date(invitation.expiresAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => acceptInvitation.mutate({ token: invitation.token })}
                disabled={acceptInvitation.isPending}
                className="rounded-lg bg-green-600 hover:bg-green-700 px-4 py-2 font-medium text-white transition disabled:opacity-50"
              >
                {acceptInvitation.isPending ? "Accepting..." : "Accept"}
              </button>
            </div>
            {acceptInvitation.error && (
              <p className="text-red-400 text-sm mt-2">
                {acceptInvitation.error.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
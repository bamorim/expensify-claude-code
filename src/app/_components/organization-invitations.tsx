"use client";

import { api } from "~/trpc/react";
import { Role, InvitationStatus } from "@prisma/client";

interface OrganizationInvitationsProps {
  organizationId: string;
  userRole: Role;
}

export function OrganizationInvitations({ organizationId, userRole }: OrganizationInvitationsProps) {
  const { data: invitations, isLoading } = api.invitation.listForOrg.useQuery(
    { organizationId },
    { enabled: userRole === Role.ADMIN }
  );

  if (userRole !== Role.ADMIN) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Invitations</h3>
        <p className="text-gray-400">Loading invitations...</p>
      </div>
    );
  }

  if (!invitations || invitations.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Invitations</h3>
        <p className="text-gray-400">No invitations found.</p>
      </div>
    );
  }

  const getStatusColor = (status: InvitationStatus, expiresAt: Date) => {
    if (status === InvitationStatus.ACCEPTED) {
      return "bg-green-500/20 text-green-400";
    }
    if (status === InvitationStatus.EXPIRED || new Date(expiresAt) < new Date()) {
      return "bg-red-500/20 text-red-400";
    }
    return "bg-yellow-500/20 text-yellow-400";
  };

  const getStatusText = (status: InvitationStatus, expiresAt: Date) => {
    if (status === InvitationStatus.ACCEPTED) {
      return "Accepted";
    }
    if (status === InvitationStatus.EXPIRED || new Date(expiresAt) < new Date()) {
      return "Expired";
    }
    return "Pending";
  };

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Invitations</h3>
      <div className="space-y-3">
        {invitations.map((invitation) => (
          <div key={invitation.id} className="flex items-center justify-between border-b border-white/10 pb-3">
            <div className="flex-1">
              <p className="text-white font-medium">{invitation.email}</p>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>Role: {invitation.role}</span>
                <span>
                  Invited by {invitation.invitedBy.name ?? invitation.invitedBy.email}
                </span>
                <span>
                  {new Date(invitation.createdAt).toLocaleDateString()}
                </span>
              </div>
              {invitation.status === InvitationStatus.PENDING && new Date(invitation.expiresAt) > new Date() && (
                <p className="text-xs text-gray-500 mt-1">
                  Expires: {new Date(invitation.expiresAt).toLocaleString()}
                </p>
              )}
            </div>
            <span className={`rounded-full px-3 py-1 text-sm ${getStatusColor(invitation.status, invitation.expiresAt)}`}>
              {getStatusText(invitation.status, invitation.expiresAt)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
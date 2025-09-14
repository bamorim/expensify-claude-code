"use client";

import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";
import { UpdateOrganization } from "./update-organization";
import { InviteUser } from "./invite-user";
import { OrganizationInvitations } from "./organization-invitations";

interface OrganizationDetailsProps {
  organizationId: string;
}

export function OrganizationDetails({ organizationId }: OrganizationDetailsProps) {
  const router = useRouter();

  try {
    const [organization] = api.organization.getById.useSuspenseQuery({
      id: organizationId
    });

    return (
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">{organization.name}</h1>
          <p className="text-gray-400">
            Created {new Date(organization.createdAt).toLocaleDateString()} by {organization.createdBy.name ?? organization.createdBy.email}
          </p>
        </div>

        <UpdateOrganization
          organizationId={organizationId}
          currentName={organization.name}
          userRole={organization.userRole}
        />

        <InviteUser
          organizationId={organizationId}
          userRole={organization.userRole}
        />

        <OrganizationInvitations
          organizationId={organizationId}
          userRole={organization.userRole}
        />

        <div className="rounded-lg bg-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Members</h3>
          <div className="space-y-3">
            {organization.memberships.map((membership) => (
              <div key={membership.id} className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">
                    {membership.user.name ?? membership.user.email}
                  </p>
                  <p className="text-sm text-gray-400">
                    Joined {new Date(membership.joinedAt).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-sm">
                  {membership.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  } catch {
    router.push("/organizations");
    return null;
  }
}
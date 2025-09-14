"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Role } from "@prisma/client";

interface InviteUserProps {
  organizationId: string;
  userRole: Role;
  onInviteSent?: () => void;
}

export function InviteUser({ organizationId, userRole, onInviteSent }: InviteUserProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.MEMBER);

  const utils = api.useUtils();

  const inviteUser = api.invitation.create.useMutation({
    onSuccess: () => {
      setEmail("");
      setRole(Role.MEMBER);
      void utils.invitation.listForOrg.invalidate({ organizationId });
      onInviteSent?.();
    },
  });

  if (userRole !== Role.ADMIN) {
    return null;
  }

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Invite User</h3>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          inviteUser.mutate({
            organizationId,
            email: email.trim(),
            role
          });
        }}
        className="space-y-4"
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            placeholder="user@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 border border-white/20 focus:border-white/40 focus:outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-300 mb-2">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
          >
            <option value={Role.MEMBER}>Member</option>
            <option value={Role.ADMIN}>Admin</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50"
          disabled={inviteUser.isPending || !email.trim()}
        >
          {inviteUser.isPending ? "Sending Invitation..." : "Send Invitation"}
        </button>

        {inviteUser.error && (
          <p className="text-red-400 text-sm">
            {inviteUser.error.message}
          </p>
        )}

        {inviteUser.isSuccess && (
          <p className="text-green-400 text-sm">
            Invitation sent successfully! Check the console for the invitation link.
          </p>
        )}
      </form>
    </div>
  );
}
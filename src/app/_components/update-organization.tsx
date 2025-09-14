"use client";

import React, { useState } from "react";
import { api } from "~/trpc/react";

interface UpdateOrganizationProps {
  organizationId: string;
  currentName: string;
  userRole: string;
}

export function UpdateOrganization({ organizationId, currentName, userRole }: UpdateOrganizationProps) {
  const [name, setName] = useState(currentName);
  const [isEditing, setIsEditing] = useState(false);

  // Update local state when currentName prop changes (from parent's reactive query)
  React.useEffect(() => {
    if (!isEditing) {
      setName(currentName);
    }
  }, [currentName, isEditing]);

  const utils = api.useUtils();
  const updateOrganization = api.organization.update.useMutation({
    onSuccess: async () => {
      await utils.organization.invalidate();
      setIsEditing(false);
    },
  });

  const isAdmin = userRole === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Organization Settings</h3>
        <p className="text-gray-400">Only administrators can modify organization settings.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Organization Settings</h3>

      {!isEditing ? (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-300">Organization Name</p>
            <p className="text-xl font-medium text-white">{currentName}</p>
          </div>
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20"
          >
            Edit
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateOrganization.mutate({ id: organizationId, name });
          }}
          className="space-y-4"
        >
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Organization Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20 disabled:opacity-50"
              disabled={updateOrganization.isPending || !name.trim()}
            >
              {updateOrganization.isPending ? "Saving..." : "Save"}
            </button>

            <button
              type="button"
              onClick={() => {
                setName(currentName);
                setIsEditing(false);
              }}
              className="rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>

          {updateOrganization.error && (
            <p className="text-red-400 text-sm">
              {updateOrganization.error.message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}
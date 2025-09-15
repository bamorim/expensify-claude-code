"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Role } from "@prisma/client";
import type { Policy, ExpenseCategory } from "@prisma/client";
import { PolicyForm } from "./policy-form";

type PolicyWithRelations = Policy & {
  category: ExpenseCategory;
  user: { id: string; name: string | null; email: string | null } | null;
};

interface PolicyListProps {
  organizationId: string;
  userRole: Role;
}

export function PolicyList({ organizationId, userRole }: PolicyListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<PolicyWithRelations | null>(null);

  const { data: policies, isLoading } = api.policy.listForOrganization.useQuery({
    organizationId,
  });

  const utils = api.useUtils();

  const deletePolicy = api.policy.delete.useMutation({
    onSuccess: () => {
      void utils.policy.listForOrganization.invalidate({ organizationId });
    },
  });

  const handleDelete = (policy: PolicyWithRelations) => {
    if (confirm(`Are you sure you want to delete this policy for "${policy.category.name}"?`)) {
      deletePolicy.mutate({ id: policy.id });
    }
  };

  const handleEdit = (policy: PolicyWithRelations) => {
    setEditingPolicy(policy);
    setShowCreateForm(false);
  };

  const handleCreateNew = () => {
    setEditingPolicy(null);
    setShowCreateForm(true);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingPolicy(null);
  };

  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingPolicy(null);
  };

  const isAdmin = userRole === Role.ADMIN;

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Expense Policies</h3>
        <p className="text-gray-400">Loading policies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Expense Policies</h3>
          {isAdmin && !showCreateForm && !editingPolicy && (
            <button
              onClick={handleCreateNew}
              className="rounded-lg bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20"
            >
              Add Policy
            </button>
          )}
        </div>

        {!policies || policies.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No expense policies found.</p>
            {isAdmin && (
              <button
                onClick={handleCreateNew}
                className="rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
              >
                Create Your First Policy
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {policies.map((policy) => (
              <div key={policy.id} className="border border-white/10 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-white font-medium">{policy.category.name}</h4>
                      <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                        {policy.user ? "User-specific" : "Organization-wide"}
                      </span>
                      {policy.requiresReview && (
                        <span className="text-xs px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-300">
                          Requires Review
                        </span>
                      )}
                    </div>

                    {policy.user && (
                      <p className="text-sm text-gray-400 mb-2">
                        For: {policy.user.name ?? policy.user.email}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-400">Maximum Amount:</span>
                        <span className="text-white ml-2">${policy.maxAmount.toString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Period:</span>
                        <span className="text-white ml-2 capitalize">{policy.period.toLowerCase()}</span>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      Created {new Date(policy.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(policy)}
                        className="rounded bg-blue-600 hover:bg-blue-700 px-3 py-1 text-sm font-medium text-white transition"
                        disabled={!!editingPolicy}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(policy)}
                        className="rounded bg-red-600 hover:bg-red-700 px-3 py-1 text-sm font-medium text-white transition"
                        disabled={deletePolicy.isPending}
                      >
                        {deletePolicy.isPending ? "..." : "Delete"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {deletePolicy.error && (
          <p className="text-red-400 text-sm mt-4">
            {deletePolicy.error.message}
          </p>
        )}
      </div>

      {(showCreateForm || editingPolicy) && isAdmin && (
        <PolicyForm
          organizationId={organizationId}
          policy={editingPolicy ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}
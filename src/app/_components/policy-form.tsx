"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { PolicyPeriod } from "@prisma/client";
import type { Policy, ExpenseCategory } from "@prisma/client";

type PolicyWithRelations = Policy & {
  category: ExpenseCategory;
  user: { id: string; name: string | null; email: string | null } | null;
};

interface PolicyFormProps {
  organizationId: string;
  policy?: PolicyWithRelations;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PolicyForm({ organizationId, policy, onSuccess, onCancel }: PolicyFormProps) {
  const [categoryId, setCategoryId] = useState(policy?.categoryId ?? "");
  const [userId, setUserId] = useState(policy?.userId ?? "");
  const [maxAmount, setMaxAmount] = useState(policy?.maxAmount.toString() ?? "");
  const [period, setPeriod] = useState<PolicyPeriod>(policy?.period ?? PolicyPeriod.MONTHLY);
  const [requiresReview, setRequiresReview] = useState(policy?.requiresReview ?? false);

  const utils = api.useUtils();

  // Fetch categories and members for dropdowns
  const { data: categories, isLoading: categoriesLoading } = api.category.list.useQuery({
    organizationId,
  });

  const { data: organization, isLoading: orgLoading } = api.organization.getById.useQuery({
    id: organizationId,
  });

  const createPolicy = api.policy.create.useMutation({
    onSuccess: () => {
      setCategoryId("");
      setUserId("");
      setMaxAmount("");
      setPeriod(PolicyPeriod.MONTHLY);
      setRequiresReview(false);
      void utils.policy.listForOrganization.invalidate({ organizationId });
      onSuccess?.();
    },
  });

  const updatePolicy = api.policy.update.useMutation({
    onSuccess: () => {
      void utils.policy.listForOrganization.invalidate({ organizationId });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (policy) {
      updatePolicy.mutate({
        id: policy.id,
        maxAmount: parseFloat(maxAmount),
        period,
        requiresReview,
      });
    } else {
      createPolicy.mutate({
        organizationId,
        categoryId,
        userId: userId || undefined,
        maxAmount: parseFloat(maxAmount),
        period,
        requiresReview,
      });
    }
  };

  const isLoading = createPolicy.isPending || updatePolicy.isPending;
  const error = createPolicy.error ?? updatePolicy.error;

  if (categoriesLoading || orgLoading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        {policy ? "Edit Policy" : "Create Policy"}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!policy && (
          <>
            <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <select
                id="categoryId"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
                required
              >
                <option value="">Select a category</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id} className="bg-gray-800">
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
                User (leave empty for organization-wide policy)
              </label>
              <select
                id="userId"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
              >
                <option value="" className="bg-gray-800">Organization-wide policy</option>
                {organization?.memberships.map((membership) => (
                  <option key={membership.user.id} value={membership.user.id} className="bg-gray-800">
                    {membership.user.name ?? membership.user.email} ({membership.role})
                  </option>
                ))}
              </select>
            </div>
          </>
        )}

        <div>
          <label htmlFor="maxAmount" className="block text-sm font-medium text-gray-300 mb-2">
            Maximum Amount *
          </label>
          <input
            id="maxAmount"
            type="number"
            step="0.01"
            min="0"
            placeholder="Enter maximum amount"
            value={maxAmount}
            onChange={(e) => setMaxAmount(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 border border-white/20 focus:border-white/40 focus:outline-none"
            required
          />
        </div>

        <div>
          <label htmlFor="period" className="block text-sm font-medium text-gray-300 mb-2">
            Period *
          </label>
          <select
            id="period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as PolicyPeriod)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
            required
          >
            <option value={PolicyPeriod.DAILY} className="bg-gray-800">Daily</option>
            <option value={PolicyPeriod.MONTHLY} className="bg-gray-800">Monthly</option>
          </select>
        </div>

        <div className="flex items-center space-x-3">
          <input
            id="requiresReview"
            type="checkbox"
            checked={requiresReview}
            onChange={(e) => setRequiresReview(e.target.checked)}
            className="rounded border-white/20 bg-white/10 text-white focus:ring-white/40"
          />
          <label htmlFor="requiresReview" className="text-sm font-medium text-gray-300">
            Requires manual review (if unchecked, expenses will be auto-approved)
          </label>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50"
            disabled={isLoading || !maxAmount.trim() || (!policy && !categoryId)}
          >
            {isLoading ? (policy ? "Updating..." : "Creating...") : (policy ? "Update Policy" : "Create Policy")}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg bg-white/5 px-6 py-3 font-semibold transition hover:bg-white/10"
            >
              Cancel
            </button>
          )}
        </div>

        {error && (
          <p className="text-red-400 text-sm">
            {error.message}
          </p>
        )}

        {(createPolicy.isSuccess || updatePolicy.isSuccess) && !error && (
          <p className="text-green-400 text-sm">
            Policy {policy ? "updated" : "created"} successfully!
          </p>
        )}
      </form>
    </div>
  );
}
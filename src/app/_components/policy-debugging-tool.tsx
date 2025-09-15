"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Role } from "@prisma/client";

interface PolicyDebuggingToolProps {
  organizationId: string;
  userRole: Role;
}

export function PolicyDebuggingTool({ organizationId, userRole }: PolicyDebuggingToolProps) {
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const { data: categories } = api.category.list.useQuery({ organizationId });
  const { data: organization } = api.organization.getById.useQuery({ id: organizationId });

  const { data: effectivePolicyResult, isLoading: policyLoading } = api.policy.getEffectivePolicy.useQuery(
    {
      organizationId,
      categoryId: selectedCategoryId,
      userId: selectedUserId || undefined,
    },
    {
      enabled: !!selectedCategoryId,
    }
  );

  const isAdmin = userRole === Role.ADMIN;

  if (!isAdmin) {
    return null; // Only admins can use the debugging tool
  }

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Policy Resolution Debugging</h3>
      <p className="text-gray-400 text-sm mb-4">
        Test which policy applies to a specific user and category combination.
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="debug-category" className="block text-sm font-medium text-gray-300 mb-2">
            Category *
          </label>
          <select
            id="debug-category"
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
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
          <label htmlFor="debug-user" className="block text-sm font-medium text-gray-300 mb-2">
            User
          </label>
          <select
            id="debug-user"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white border border-white/20 focus:border-white/40 focus:outline-none"
          >
            <option value="" className="bg-gray-800">Select a user</option>
            {organization?.memberships.map((membership) => (
              <option key={membership.user.id} value={membership.user.id} className="bg-gray-800">
                {membership.user.name ?? membership.user.email} ({membership.role})
              </option>
            ))}
          </select>
        </div>

        {selectedCategoryId && (
          <div className="border-t border-white/10 pt-4">
            <h4 className="text-white font-medium mb-3">Policy Resolution Result</h4>

            {policyLoading ? (
              <p className="text-gray-400">Resolving policy...</p>
            ) : effectivePolicyResult?.policy ? (
              <div className="bg-white/5 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-green-400 font-medium">✓ Policy Found</span>
                  <span className="text-xs px-2 py-1 rounded-full bg-blue-500/20 text-blue-300">
                    {effectivePolicyResult.policyType}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Maximum Amount:</span>
                    <span className="text-white ml-2">${effectivePolicyResult.policy.maxAmount.toString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Period:</span>
                    <span className="text-white ml-2 capitalize">
                      {effectivePolicyResult.policy.period.toLowerCase()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Requires Review:</span>
                    <span className="text-white ml-2">
                      {effectivePolicyResult.policy.requiresReview ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400">Approval:</span>
                    <span className={`ml-2 font-medium ${
                      effectivePolicyResult.policy.requiresReview ? "text-yellow-400" : "text-green-400"
                    }`}>
                      {effectivePolicyResult.policy.requiresReview ? "Manual Review" : "Auto-Approve"}
                    </span>
                  </div>
                </div>

                <div className="text-xs text-gray-500">
                  Policy ID: {effectivePolicyResult.policy.id}
                  <br />
                  Created: {new Date(effectivePolicyResult.policy.createdAt).toLocaleDateString()}
                </div>

                {effectivePolicyResult.policyType === "user-specific" && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3">
                    <p className="text-blue-300 text-sm">
                      <strong>User-specific policy override:</strong> This user has a custom policy that takes precedence over the organization-wide policy.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <div className="flex items-center gap-2 text-red-400 font-medium mb-2">
                  <span>⚠️ No Policy Found</span>
                </div>
                <p className="text-red-300 text-sm">
                  No expense policy exists for this category{selectedUserId ? " and user" : ""}.
                  Expenses in this category will not be subject to automatic limits or approval rules.
                </p>
                <p className="text-red-300 text-sm mt-2">
                  <strong>Recommendation:</strong> Create an organization-wide policy for this category to ensure proper expense management.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
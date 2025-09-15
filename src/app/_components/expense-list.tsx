"use client";

import { useState } from "react";
import { ExpenseStatus } from "@prisma/client";
import { api } from "~/trpc/react";

interface ExpenseListProps {
  organizationId: string;
  statusFilter?: ExpenseStatus;
}

export function ExpenseList({ organizationId, statusFilter }: ExpenseListProps) {
  const [selectedExpense, setSelectedExpense] = useState<string | null>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    api.expense.list.useInfiniteQuery(
      {
        organizationId,
        status: statusFilter,
        limit: 20,
      },
      {
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  const expenses = data?.pages.flatMap((page) => page.expenses) ?? [];

  const getStatusColor = (status: ExpenseStatus) => {
    switch (status) {
      case ExpenseStatus.APPROVED:
        return "text-green-400 bg-green-600/20";
      case ExpenseStatus.REJECTED:
        return "text-red-400 bg-red-600/20";
      case ExpenseStatus.SUBMITTED:
        return "text-yellow-400 bg-yellow-600/20";
      default:
        return "text-gray-400 bg-gray-600/20";
    }
  };

  const getStatusText = (status: ExpenseStatus) => {
    switch (status) {
      case ExpenseStatus.APPROVED:
        return "Approved";
      case ExpenseStatus.REJECTED:
        return "Rejected";
      case ExpenseStatus.SUBMITTED:
        return "Pending Review";
      default:
        return status;
    }
  };

  if (expenses.length === 0) {
    return (
      <div className="rounded-lg bg-white/5 p-8 text-center">
        <h3 className="text-lg font-semibold text-white mb-2">No expenses found</h3>
        <p className="text-gray-400">
          {statusFilter
            ? `No expenses with status "${getStatusText(statusFilter)}" found.`
            : "You haven't submitted any expenses yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">
        Your Expenses
        {statusFilter && ` - ${getStatusText(statusFilter)}`}
      </h2>

      <div className="space-y-4">
        {expenses.map((expense) => (
          <div
            key={expense.id}
            className="rounded-lg bg-white/5 border border-gray-600/50 p-6 hover:bg-white/10 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <h3 className="text-lg font-semibold text-white">
                    ${expense.amount.toFixed(2)}
                  </h3>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(
                      expense.status,
                    )}`}
                  >
                    {getStatusText(expense.status)}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Category</p>
                    <p className="text-white font-medium">{expense.category.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Date</p>
                    <p className="text-white font-medium">
                      {new Date(expense.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Submitted</p>
                    <p className="text-white font-medium">
                      {new Date(expense.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-gray-400 text-sm mb-1">Description</p>
                  <p className="text-white">{expense.description}</p>
                </div>

                {expense.reviewer && (
                  <div className="mt-3">
                    <p className="text-gray-400 text-sm mb-1">Reviewed by</p>
                    <p className="text-white text-sm">
                      {expense.reviewer.name ?? "Unknown"}
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() =>
                  setSelectedExpense(
                    selectedExpense === expense.id ? null : expense.id,
                  )
                }
                className="text-gray-400 hover:text-white transition-colors"
              >
                {selectedExpense === expense.id ? "Hide Details" : "Show Details"}
              </button>
            </div>

            {selectedExpense === expense.id && (
              <div className="mt-6 pt-6 border-t border-gray-600/50 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400">Policy Applied</p>
                    <p className="text-white">
                      Max ${expense.policy.maxAmount.toFixed(2)} per{" "}
                      {expense.policy.period.toLowerCase()}
                    </p>
                    <p className="text-gray-400 text-xs">
                      {expense.policy.requiresReview
                        ? "Requires manual review"
                        : "Auto-approval enabled"}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400">Expense ID</p>
                    <p className="text-white font-mono text-xs">{expense.id}</p>
                  </div>
                </div>

                {expense.status === ExpenseStatus.REJECTED && (
                  <div className="rounded-lg bg-red-600/20 border border-red-600/30 p-4">
                    <p className="text-red-300 font-medium">Rejection Reason</p>
                    <p className="text-red-200 text-sm mt-1">
                      This expense was automatically rejected due to policy violations.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {hasNextPage && (
        <div className="text-center">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg bg-white/5 border border-gray-600/50 px-6 py-3 text-white hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isFetchingNextPage ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
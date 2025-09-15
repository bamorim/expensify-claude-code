"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ExpenseStatus } from "@prisma/client";
import { api } from "~/trpc/react";
import { ExpenseForm } from "./expense-form";
import { ExpenseList } from "./expense-list";

interface ExpenseDashboardProps {
  organizationId: string;
}

export function ExpenseDashboard({ organizationId }: ExpenseDashboardProps) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExpenseStatus | "ALL">("ALL");

  // Use regular queries with error handling instead of suspense queries
  const organizationQuery = api.organization.getById.useQuery({
    id: organizationId,
  });

  // Only fetch stats if organization query is successful
  const statsQuery = api.expense.getStats.useQuery(
    {
      organizationId,
    },
    {
      enabled: !!organizationQuery.data,
    }
  );

  // Handle errors with useEffect to avoid setState during render
  useEffect(() => {
    if (organizationQuery.error) {
      router.push("/organizations");
    }
  }, [organizationQuery.error, router]);

  // Show loading state
  if (organizationQuery.isLoading) {
    return (
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <div className="text-white">Loading...</div>
        </div>
      </div>
    );
  }

  // Handle organization error or no data
  if (organizationQuery.error || !organizationQuery.data) {
    return null; // useEffect will handle redirect
  }

  // Show loading for stats
  if (statsQuery.isLoading) {
    return (
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <div className="text-white">Loading expenses...</div>
        </div>
      </div>
    );
  }

  // Handle stats error
  if (statsQuery.error || !statsQuery.data) {
    return (
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <div className="text-red-400">Error loading expense data</div>
        </div>
      </div>
    );
  }

  const organization = organizationQuery.data;
  const stats = statsQuery.data;

    return (
      <div className="w-full max-w-6xl space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-4 mb-4">
            <Link
              href={`/organizations/${organizationId}`}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to {organization.name}
            </Link>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">My Expenses</h1>
          <p className="text-gray-400">
            Submit and manage your expense reports
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="rounded-lg bg-white/5 p-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Total Approved
            </h3>
            <div className="mt-2">
              <p className="text-2xl font-bold text-green-400">
                ${stats.allTime.approvedAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">
                {stats.allTime.approvedCount} expenses
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 p-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              This Month
            </h3>
            <div className="mt-2">
              <p className="text-2xl font-bold text-blue-400">
                ${(stats.thisMonth.approvedAmount + stats.thisMonth.pendingAmount).toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">
                {stats.thisMonth.approvedCount + stats.thisMonth.pendingCount} expenses
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 p-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Pending Review
            </h3>
            <div className="mt-2">
              <p className="text-2xl font-bold text-yellow-400">
                ${stats.allTime.pendingAmount.toFixed(2)}
              </p>
              <p className="text-sm text-gray-400">
                {stats.allTime.pendingCount} expenses
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-white/5 p-6">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
              Rejected
            </h3>
            <div className="mt-2">
              <p className="text-2xl font-bold text-red-400">
                {stats.allTime.rejectedCount}
              </p>
              <p className="text-sm text-gray-400">
                ${stats.allTime.rejectedAmount.toFixed(2)} rejected
              </p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
          <button
            onClick={() => setShowForm(!showForm)}
            className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700"
          >
            {showForm ? "Cancel" : "Submit New Expense"}
          </button>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-400">
              Filter by status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ExpenseStatus | "ALL")}
              className="rounded-lg border border-gray-600 bg-white/5 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
            >
              <option value="ALL">All Expenses</option>
              <option value={ExpenseStatus.SUBMITTED}>Pending Review</option>
              <option value={ExpenseStatus.APPROVED}>Approved</option>
              <option value={ExpenseStatus.REJECTED}>Rejected</option>
            </select>
          </div>
        </div>

        {/* Expense Form */}
        {showForm && (
          <div className="rounded-lg bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white mb-6">
              Submit New Expense
            </h2>
            <ExpenseForm
              organizationId={organizationId}
              onSuccess={() => setShowForm(false)}
            />
          </div>
        )}

        {/* Expense List */}
        <ExpenseList
          organizationId={organizationId}
          statusFilter={statusFilter === "ALL" ? undefined : statusFilter}
        />
      </div>
    );
}
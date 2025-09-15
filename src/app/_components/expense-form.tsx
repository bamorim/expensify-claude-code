"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

interface ExpenseFormProps {
  organizationId: string;
  onSuccess?: () => void;
}

interface FormData {
  amount: string;
  date: string;
  description: string;
  categoryId: string;
}

export function ExpenseForm({ organizationId, onSuccess }: ExpenseFormProps) {
  const [formData, setFormData] = useState<FormData>({
    amount: "",
    date: new Date().toISOString().split('T')[0] ?? "", // Today's date
    description: "",
    categoryId: "",
  });

  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
    autoApproved?: boolean;
  } | null>(null);

  const utils = api.useUtils();

  const { data: categories = [] } = api.category.list.useQuery({
    organizationId,
  });

  const submitMutation = api.expense.submit.useMutation({
    onSuccess: async (result) => {
      setSubmitResult({
        success: result.status !== "REJECTED",
        message: result.rejectionReason ??
          (result.autoApproved
            ? "Expense submitted and automatically approved!"
            : "Expense submitted for review."),
        autoApproved: result.autoApproved,
      });

      // Reset form on success
      if (result.status !== "REJECTED") {
        setFormData({
          amount: "",
          date: new Date().toISOString().split('T')[0] ?? "",
          description: "",
          categoryId: "",
        });
      }

      // Invalidate and refetch related queries
      await utils.expense.list.invalidate();
      await utils.expense.getStats.invalidate();

      onSuccess?.();
    },
    onError: (error) => {
      setSubmitResult({
        success: false,
        message: error.message,
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitResult(null);

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      setSubmitResult({
        success: false,
        message: "Please enter a valid amount",
      });
      return;
    }

    if (!formData.categoryId) {
      setSubmitResult({
        success: false,
        message: "Please select a category",
      });
      return;
    }

    if (!formData.description.trim()) {
      setSubmitResult({
        success: false,
        message: "Please enter a description",
      });
      return;
    }

    submitMutation.mutate({
      amount,
      date: new Date(formData.date),
      description: formData.description.trim(),
      categoryId: formData.categoryId,
      organizationId,
    });
  };

  const isLoading = submitMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Result Message */}
      {submitResult && (
        <div
          className={`rounded-lg p-4 ${
            submitResult.success
              ? "bg-green-600/20 border border-green-600/30 text-green-300"
              : "bg-red-600/20 border border-red-600/30 text-red-300"
          }`}
        >
          <p className="font-medium">{submitResult.message}</p>
          {submitResult.autoApproved && (
            <p className="text-sm mt-1">
              This expense was automatically approved based on your organization&apos;s policies.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Amount */}
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-2">
            Amount ($)
          </label>
          <input
            id="amount"
            type="number"
            step="0.01"
            min="0.01"
            max="999999.99"
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            className="w-full rounded-lg border border-gray-600 bg-white/5 px-3 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none"
            placeholder="0.00"
            required
            disabled={isLoading}
          />
        </div>

        {/* Date */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-2">
            Expense Date
          </label>
          <input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            className="w-full rounded-lg border border-gray-600 bg-white/5 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
            required
            disabled={isLoading}
          />
        </div>
      </div>

      {/* Category */}
      <div>
        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-2">
          Category
        </label>
        <select
          id="category"
          value={formData.categoryId}
          onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
          className="w-full rounded-lg border border-gray-600 bg-white/5 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
          required
          disabled={isLoading}
        >
          <option value="">Select a category</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
              {category.description && ` - ${category.description}`}
            </option>
          ))}
        </select>
      </div>

      {/* Description */}
      <div>
        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
          Description
        </label>
        <textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          maxLength={500}
          rows={3}
          className="w-full rounded-lg border border-gray-600 bg-white/5 px-3 py-2 text-white placeholder-gray-400 focus:border-purple-500 focus:outline-none resize-none"
          placeholder="Describe your expense..."
          required
          disabled={isLoading}
        />
        <p className="text-xs text-gray-400 mt-1">
          {formData.description.length}/500 characters
        </p>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "Submitting..." : "Submit Expense"}
        </button>
      </div>
    </form>
  );
}
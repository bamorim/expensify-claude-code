"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import type { ExpenseCategory } from "@prisma/client";

interface CategoryFormProps {
  organizationId: string;
  category?: ExpenseCategory;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function CategoryForm({ organizationId, category, onSuccess, onCancel }: CategoryFormProps) {
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");

  const utils = api.useUtils();

  const createCategory = api.category.create.useMutation({
    onSuccess: () => {
      setName("");
      setDescription("");
      void utils.category.list.invalidate({ organizationId });
      onSuccess?.();
    },
  });

  const updateCategory = api.category.update.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate({ organizationId });
      onSuccess?.();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (category) {
      updateCategory.mutate({
        id: category.id,
        name: name.trim(),
        description: description.trim() || undefined,
      });
    } else {
      createCategory.mutate({
        organizationId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
    }
  };

  const isLoading = createCategory.isPending || updateCategory.isPending;
  const error = createCategory.error ?? updateCategory.error;

  return (
    <div className="rounded-lg bg-white/5 p-6">
      <h3 className="text-lg font-semibold text-white mb-4">
        {category ? "Edit Category" : "Create Category"}
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
            Category Name *
          </label>
          <input
            id="name"
            type="text"
            placeholder="Enter category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 border border-white/20 focus:border-white/40 focus:outline-none"
            required
            maxLength={100}
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            id="description"
            placeholder="Enter optional description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 border border-white/20 focus:border-white/40 focus:outline-none resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50"
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? (category ? "Updating..." : "Creating...") : (category ? "Update Category" : "Create Category")}
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

        {(createCategory.isSuccess || updateCategory.isSuccess) && !error && (
          <p className="text-green-400 text-sm">
            Category {category ? "updated" : "created"} successfully!
          </p>
        )}
      </form>
    </div>
  );
}
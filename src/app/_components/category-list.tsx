"use client";

import { useState } from "react";
import { api } from "~/trpc/react";
import { Role } from "@prisma/client";
import type { ExpenseCategory } from "@prisma/client";
import { CategoryForm } from "./category-form";

interface CategoryListProps {
  organizationId: string;
  userRole: Role;
}

export function CategoryList({ organizationId, userRole }: CategoryListProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ExpenseCategory | null>(null);

  const { data: categories, isLoading } = api.category.list.useQuery({ organizationId });

  const utils = api.useUtils();

  const deleteCategory = api.category.delete.useMutation({
    onSuccess: () => {
      void utils.category.list.invalidate({ organizationId });
    },
  });

  const handleDelete = (category: ExpenseCategory) => {
    if (confirm(`Are you sure you want to delete the category "${category.name}"?`)) {
      deleteCategory.mutate({ id: category.id });
    }
  };

  const handleEdit = (category: ExpenseCategory) => {
    setEditingCategory(category);
    setShowCreateForm(false);
  };

  const handleCreateNew = () => {
    setEditingCategory(null);
    setShowCreateForm(true);
  };

  const handleFormSuccess = () => {
    setShowCreateForm(false);
    setEditingCategory(null);
  };

  const handleFormCancel = () => {
    setShowCreateForm(false);
    setEditingCategory(null);
  };

  const isAdmin = userRole === Role.ADMIN;

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Expense Categories</h3>
        <p className="text-gray-400">Loading categories...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg bg-white/5 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Expense Categories</h3>
          {isAdmin && !showCreateForm && !editingCategory && (
            <button
              onClick={handleCreateNew}
              className="rounded-lg bg-white/10 px-4 py-2 font-medium text-white transition hover:bg-white/20"
            >
              Add Category
            </button>
          )}
        </div>

        {!categories || categories.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-400 mb-4">No expense categories found.</p>
            {isAdmin && (
              <button
                onClick={handleCreateNew}
                className="rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20"
              >
                Create Your First Category
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex-1">
                  <h4 className="text-white font-medium">{category.name}</h4>
                  {category.description && (
                    <p className="text-sm text-gray-400 mt-1">{category.description}</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Created {new Date(category.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(category)}
                      className="rounded bg-blue-600 hover:bg-blue-700 px-3 py-1 text-sm font-medium text-white transition"
                      disabled={!!editingCategory}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(category)}
                      className="rounded bg-red-600 hover:bg-red-700 px-3 py-1 text-sm font-medium text-white transition"
                      disabled={deleteCategory.isPending}
                    >
                      {deleteCategory.isPending ? "..." : "Delete"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {deleteCategory.error && (
          <p className="text-red-400 text-sm mt-4">
            {deleteCategory.error.message}
          </p>
        )}
      </div>

      {(showCreateForm || editingCategory) && isAdmin && (
        <CategoryForm
          organizationId={organizationId}
          category={editingCategory ?? undefined}
          onSuccess={handleFormSuccess}
          onCancel={handleFormCancel}
        />
      )}
    </div>
  );
}
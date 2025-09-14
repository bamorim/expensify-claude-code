"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "~/trpc/react";

export function CreateOrganization() {
  const router = useRouter();
  const [name, setName] = useState("");

  const createOrganization = api.organization.create.useMutation({
    onSuccess: (organization) => {
      router.push(`/organizations/${organization.id}`);
    },
  });

  return (
    <div className="w-full max-w-md">
      <h2 className="text-2xl font-bold text-white mb-6">Create Organization</h2>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          createOrganization.mutate({ name });
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
            placeholder="Enter organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg bg-white/10 px-4 py-3 text-white placeholder-gray-400 border border-white/20 focus:border-white/40 focus:outline-none"
            required
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            className="flex-1 rounded-lg bg-white/10 px-6 py-3 font-semibold transition hover:bg-white/20 disabled:opacity-50"
            disabled={createOrganization.isPending || !name.trim()}
          >
            {createOrganization.isPending ? "Creating..." : "Create Organization"}
          </button>

          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-lg bg-white/5 px-6 py-3 font-semibold transition hover:bg-white/10"
          >
            Cancel
          </button>
        </div>

        {createOrganization.error && (
          <p className="text-red-400 text-sm">
            {createOrganization.error.message}
          </p>
        )}
      </form>
    </div>
  );
}
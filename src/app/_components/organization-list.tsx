"use client";

import Link from "next/link";
import { api } from "~/trpc/react";

export function OrganizationList() {
  const [organizations] = api.organization.list.useSuspenseQuery();

  return (
    <div className="w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Your Organizations</h2>
        <Link
          href="/organizations/new"
          className="rounded-full bg-white/10 px-6 py-2 font-semibold transition hover:bg-white/20"
        >
          Create Organization
        </Link>
      </div>

      {organizations.length === 0 ? (
        <div className="rounded-lg bg-white/5 p-8 text-center">
          <p className="text-gray-400 mb-4">You don&apos;t belong to any organizations yet.</p>
          <Link
            href="/organizations/new"
            className="rounded-full bg-white/10 px-6 py-2 font-semibold transition hover:bg-white/20"
          >
            Create Your First Organization
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {organizations.map((org) => (
            <Link
              key={org.id}
              href={`/organizations/${org.id}`}
              className="block rounded-lg bg-white/5 p-6 transition hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-white">{org.name}</h3>
                  <p className="text-gray-400">
                    Role: {org.userRole}
                  </p>
                  <p className="text-sm text-gray-500">
                    Created {new Date(org.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-gray-400">→</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
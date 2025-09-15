import type { Policy } from "@prisma/client";
import type { Context } from "~/server/api/trpc";

/**
 * Policy resolution engine that determines the effective expense policy for a user and category.
 * User-specific policies take precedence over organization-wide policies.
 */
export async function getPolicyForUserAndCategory(
  ctx: Context,
  organizationId: string,
  categoryId: string,
  userId?: string,
): Promise<Policy | null> {
  // First check for user-specific policy if userId is provided
  if (userId) {
    const userPolicy = await ctx.db.policy.findFirst({
      where: {
        organizationId,
        categoryId,
        userId,
      },
    });

    if (userPolicy) {
      return userPolicy;
    }
  }

  // Fall back to organization-wide policy
  const orgPolicy = await ctx.db.policy.findFirst({
    where: {
      organizationId,
      categoryId,
      userId: null,
    },
  });

  return orgPolicy;
}
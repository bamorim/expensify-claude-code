import { TRPCError } from "@trpc/server";
import { Role } from "@prisma/client";
import type { Context } from "~/server/api/trpc";

export async function requireOrgMembership(
  ctx: Context,
  organizationId: string,
): Promise<{ role: Role }> {
  if (!ctx.session?.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this organization",
    });
  }

  // After checking session exists, we can safely access it
  const userId = ctx.session.user.id;

  const membership = await ctx.db.membership.findUnique({
    where: {
      userId_organizationId: {
        userId,
        organizationId,
      },
    },
  });

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You are not a member of this organization",
    });
  }

  return { role: membership.role };
}

export async function requireOrgAdmin(
  ctx: Context,
  organizationId: string,
): Promise<void> {
  const { role } = await requireOrgMembership(ctx, organizationId);

  if (role !== Role.ADMIN) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be an organization admin to perform this action",
    });
  }
}
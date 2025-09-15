import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { PolicyPeriod } from "@prisma/client";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { requireOrgMembership, requireOrgAdmin } from "~/server/api/utils/auth";
import { getPolicyForUserAndCategory } from "~/server/api/utils/policy";

export const policyRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      categoryId: z.string(),
      userId: z.string().optional(), // Optional for organization-wide policies
      maxAmount: z.number().positive(),
      period: z.enum([PolicyPeriod.DAILY, PolicyPeriod.MONTHLY]),
      requiresReview: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.organizationId);

      // Verify category exists and belongs to organization
      const category = await ctx.db.expenseCategory.findUnique({
        where: { id: input.categoryId },
        select: { organizationId: true },
      });

      if (!category || category.organizationId !== input.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found in this organization",
        });
      }

      // If userId provided, verify user is member of organization
      if (input.userId) {
        await requireOrgMembership(ctx, input.organizationId);

        const membership = await ctx.db.membership.findUnique({
          where: {
            userId_organizationId: {
              userId: input.userId,
              organizationId: input.organizationId,
            },
          },
        });

        if (!membership) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "User is not a member of this organization",
          });
        }
      }

      // Check if policy already exists for this combination
      const existingPolicy = await ctx.db.policy.findFirst({
        where: {
          organizationId: input.organizationId,
          categoryId: input.categoryId,
          userId: input.userId ?? null,
        },
      });

      if (existingPolicy) {
        throw new TRPCError({
          code: "CONFLICT",
          message: input.userId
            ? "A policy already exists for this user and category"
            : "An organization-wide policy already exists for this category",
        });
      }

      const policy = await ctx.db.policy.create({
        data: {
          organizationId: input.organizationId,
          categoryId: input.categoryId,
          userId: input.userId ?? null,
          maxAmount: input.maxAmount,
          period: input.period,
          requiresReview: input.requiresReview,
        },
        include: {
          category: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return policy;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      maxAmount: z.number().positive(),
      period: z.enum([PolicyPeriod.DAILY, PolicyPeriod.MONTHLY]),
      requiresReview: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First, get the policy to check organization membership
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      await requireOrgAdmin(ctx, policy.organizationId);

      const updatedPolicy = await ctx.db.policy.update({
        where: { id: input.id },
        data: {
          maxAmount: input.maxAmount,
          period: input.period,
          requiresReview: input.requiresReview,
        },
        include: {
          category: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      return updatedPolicy;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First, get the policy to check organization membership
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      await requireOrgAdmin(ctx, policy.organizationId);

      await ctx.db.policy.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  listForOrganization: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Members can view policies, but only admins can modify them
      await requireOrgMembership(ctx, input.organizationId);

      const policies = await ctx.db.policy.findMany({
        where: {
          organizationId: input.organizationId,
        },
        include: {
          category: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [
          { category: { name: "asc" } },
          { userId: "asc" }, // Organization-wide policies (null userId) first, then user-specific
        ],
      });

      return policies;
    }),

  listForUser: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      userId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgMembership(ctx, input.organizationId);

      const targetUserId = input.userId ?? ctx.session?.user.id;

      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID is required",
        });
      }

      // Verify target user is member of organization
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      const policies = await ctx.db.policy.findMany({
        where: {
          organizationId: input.organizationId,
          userId: targetUserId,
        },
        include: {
          category: true,
        },
        orderBy: { category: { name: "asc" } },
      });

      return policies;
    }),

  getEffectivePolicy: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      categoryId: z.string(),
      userId: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgMembership(ctx, input.organizationId);

      const targetUserId = input.userId ?? ctx.session?.user.id;

      if (!targetUserId) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User ID is required",
        });
      }

      // Verify target user is member of organization
      const membership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: targetUserId,
            organizationId: input.organizationId,
          },
        },
      });

      if (!membership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this organization",
        });
      }

      // Verify category exists and belongs to organization
      const category = await ctx.db.expenseCategory.findUnique({
        where: { id: input.categoryId },
        select: { organizationId: true },
      });

      if (!category || category.organizationId !== input.organizationId) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found in this organization",
        });
      }

      const effectivePolicy = await getPolicyForUserAndCategory(
        ctx,
        input.organizationId,
        input.categoryId,
        targetUserId,
      );

      return {
        policy: effectivePolicy,
        policyType: effectivePolicy?.userId ? "user-specific" : "organization-wide",
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const policy = await ctx.db.policy.findUnique({
        where: { id: input.id },
        include: {
          category: true,
          user: {
            select: { id: true, name: true, email: true },
          },
        },
      });

      if (!policy) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Policy not found",
        });
      }

      // Check organization membership
      await requireOrgMembership(ctx, policy.organizationId);

      return policy;
    }),
});
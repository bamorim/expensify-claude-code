import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { requireOrgMembership, requireOrgAdmin } from "~/server/api/utils/auth";

export const categoryRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.organizationId);

      // Check if category name already exists in organization
      const existingCategory = await ctx.db.expenseCategory.findUnique({
        where: {
          name_organizationId: {
            name: input.name,
            organizationId: input.organizationId,
          },
        },
      });

      if (existingCategory) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A category with this name already exists in this organization",
        });
      }

      const category = await ctx.db.expenseCategory.create({
        data: {
          name: input.name,
          description: input.description,
          organizationId: input.organizationId,
        },
      });

      return category;
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(1).max(100),
      description: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // First, get the category to check organization membership
      const category = await ctx.db.expenseCategory.findUnique({
        where: { id: input.id },
        select: { organizationId: true, name: true },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      await requireOrgAdmin(ctx, category.organizationId);

      // Check if new name conflicts with existing category (excluding current one)
      if (input.name !== category.name) {
        const existingCategory = await ctx.db.expenseCategory.findUnique({
          where: {
            name_organizationId: {
              name: input.name,
              organizationId: category.organizationId,
            },
          },
        });

        if (existingCategory) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A category with this name already exists in this organization",
          });
        }
      }

      const updatedCategory = await ctx.db.expenseCategory.update({
        where: { id: input.id },
        data: {
          name: input.name,
          description: input.description,
        },
      });

      return updatedCategory;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First, get the category to check organization membership
      const category = await ctx.db.expenseCategory.findUnique({
        where: { id: input.id },
        select: { organizationId: true },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      await requireOrgAdmin(ctx, category.organizationId);

      await ctx.db.expenseCategory.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  list: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Members can view categories, but only admins can modify them
      await requireOrgMembership(ctx, input.organizationId);

      const categories = await ctx.db.expenseCategory.findMany({
        where: {
          organizationId: input.organizationId,
        },
        orderBy: { name: "asc" },
      });

      return categories;
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.db.expenseCategory.findUnique({
        where: { id: input.id },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // Check organization membership
      await requireOrgMembership(ctx, category.organizationId);

      return category;
    }),
});
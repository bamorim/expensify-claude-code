import { z } from "zod";
import { ExpenseStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { requireOrgMembership } from "~/server/api/utils/auth";
import { submitExpense } from "~/server/api/utils/expense";

export const expenseRouter = createTRPCRouter({
  /**
   * Submit a new expense with automatic policy application
   */
  submit: protectedProcedure
    .input(
      z.object({
        amount: z.number().positive().max(999999.99),
        date: z.date(),
        description: z.string().min(1).max(500),
        categoryId: z.string(),
        organizationId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { amount, date, description, categoryId, organizationId } = input;
      const userId = ctx.session.user.id;

      // Verify user is a member of the organization
      await requireOrgMembership(ctx, organizationId);

      // Verify category exists and belongs to the organization
      const category = await ctx.db.expenseCategory.findFirst({
        where: {
          id: categoryId,
          organizationId,
        },
      });

      if (!category) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Category not found",
        });
      }

      // Submit expense with policy application
      const result = await submitExpense(ctx, {
        amount,
        date,
        description,
        categoryId,
        organizationId,
        userId,
      });

      return {
        ...result,
        // Ensure consistent number types
        status: result.status,
        autoApproved: result.autoApproved,
        rejectionReason: result.rejectionReason,
      };
    }),

  /**
   * List expenses for the current user with filtering and pagination
   */
  list: protectedProcedure
    .input(
      z.object({
        organizationId: z.string(),
        status: z.nativeEnum(ExpenseStatus).optional(),
        categoryId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { organizationId, status, categoryId, limit, cursor } = input;
      const userId = ctx.session.user.id;

      // Verify user is a member of the organization
      await requireOrgMembership(ctx, organizationId);

      const expenses = await ctx.db.expense.findMany({
        where: {
          userId,
          organizationId,
          ...(status && { status }),
          ...(categoryId && { categoryId }),
        },
        include: {
          category: true,
          policy: true,
          reviewer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit + 1,
        ...(cursor && {
          cursor: {
            id: cursor,
          },
          skip: 1,
        }),
      });

      let nextCursor: string | undefined;
      if (expenses.length > limit) {
        const nextItem = expenses.pop();
        nextCursor = nextItem?.id;
      }

      return {
        expenses: expenses.map(expense => ({
          ...expense,
          amount: expense.amount.toNumber(),
          policy: {
            ...expense.policy,
            maxAmount: expense.policy.maxAmount.toNumber(),
          },
        })),
        nextCursor,
      };
    }),

  /**
   * Get expense details by ID
   */
  getById: protectedProcedure
    .input(z.object({ id: z.string(), organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { id, organizationId } = input;
      const userId = ctx.session.user.id;

      // Verify user is a member of the organization
      await requireOrgMembership(ctx, organizationId);

      const expense = await ctx.db.expense.findFirst({
        where: {
          id,
          userId, // Users can only view their own expenses
          organizationId,
        },
        include: {
          category: true,
          policy: true,
          reviewer: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (!expense) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Expense not found",
        });
      }

      return {
        ...expense,
        amount: expense.amount.toNumber(),
        policy: {
          ...expense.policy,
          maxAmount: expense.policy.maxAmount.toNumber(),
        },
      };
    }),

  /**
   * Get expense statistics for the current user
   */
  getStats: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { organizationId } = input;
      const userId = ctx.session.user.id;

      // Verify user is a member of the organization
      await requireOrgMembership(ctx, organizationId);

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // Get comprehensive stats with clear separation
      const [
        allTimeApproved,
        allTimePending,
        allTimeRejected,
        thisMonthApproved,
        thisMonthPending,
        thisMonthRejected,
        totalCount,
        thisMonthTotalCount,
      ] = await Promise.all([
        // All time stats
        ctx.db.expense.aggregate({
          where: { userId, organizationId, status: ExpenseStatus.APPROVED },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.expense.aggregate({
          where: { userId, organizationId, status: ExpenseStatus.SUBMITTED },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.expense.aggregate({
          where: { userId, organizationId, status: ExpenseStatus.REJECTED },
          _sum: { amount: true },
          _count: true,
        }),
        // This month stats
        ctx.db.expense.aggregate({
          where: {
            userId,
            organizationId,
            status: ExpenseStatus.APPROVED,
            createdAt: { gte: startOfMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.expense.aggregate({
          where: {
            userId,
            organizationId,
            status: ExpenseStatus.SUBMITTED,
            createdAt: { gte: startOfMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),
        ctx.db.expense.aggregate({
          where: {
            userId,
            organizationId,
            status: ExpenseStatus.REJECTED,
            createdAt: { gte: startOfMonth },
          },
          _sum: { amount: true },
          _count: true,
        }),
        // Total counts
        ctx.db.expense.count({
          where: { userId, organizationId },
        }),
        ctx.db.expense.count({
          where: { userId, organizationId, createdAt: { gte: startOfMonth } },
        }),
      ]);

      return {
        allTime: {
          totalCount,
          approvedCount: allTimeApproved._count,
          approvedAmount: allTimeApproved._sum.amount?.toNumber() ?? 0,
          pendingCount: allTimePending._count,
          pendingAmount: allTimePending._sum.amount?.toNumber() ?? 0,
          rejectedCount: allTimeRejected._count,
          rejectedAmount: allTimeRejected._sum.amount?.toNumber() ?? 0,
        },
        thisMonth: {
          totalCount: thisMonthTotalCount,
          approvedCount: thisMonthApproved._count,
          approvedAmount: thisMonthApproved._sum.amount?.toNumber() ?? 0,
          pendingCount: thisMonthPending._count,
          pendingAmount: thisMonthPending._sum.amount?.toNumber() ?? 0,
          rejectedCount: thisMonthRejected._count,
          rejectedAmount: thisMonthRejected._sum.amount?.toNumber() ?? 0,
        },
      };
    }),
});
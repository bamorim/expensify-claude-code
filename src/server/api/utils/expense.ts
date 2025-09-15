import { ExpenseStatus, PolicyPeriod } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { Context } from "~/server/api/trpc";
import { getPolicyForUserAndCategory } from "./policy";

export interface ExpenseSubmissionResult {
  expenseId: string;
  status: ExpenseStatus;
  autoApproved: boolean;
  rejectionReason?: string;
}

/**
 * Submits an expense with automatic policy application and routing
 */
export async function submitExpense(
  ctx: Context,
  data: {
    amount: number;
    date: Date;
    description: string;
    categoryId: string;
    organizationId: string;
    userId: string;
  },
): Promise<ExpenseSubmissionResult> {
  const { amount, date, description, categoryId, organizationId, userId } = data;

  // Get the applicable policy for this user and category
  const policy = await getPolicyForUserAndCategory(
    ctx,
    organizationId,
    categoryId,
    userId,
  );

  if (!policy) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "No policy found for this category. Please contact your administrator.",
    });
  }

  // Check if expense amount exceeds policy limit
  const maxAmountNumber = policy.maxAmount.toNumber();
  if (amount > maxAmountNumber) {
    // Auto-reject expenses over policy limit
    const expense = await ctx.db.expense.create({
      data: {
        amount,
        date,
        description,
        status: ExpenseStatus.REJECTED,
        userId,
        organizationId,
        categoryId,
        policyId: policy.id,
      },
    });

    return {
      expenseId: expense.id,
      status: ExpenseStatus.REJECTED,
      autoApproved: false,
      rejectionReason: `Amount $${amount.toFixed(2)} exceeds policy limit of $${maxAmountNumber.toFixed(2)}`,
    };
  }

  // Check period limits if applicable
  const periodExceeded = await checkPeriodLimits(
    ctx,
    userId,
    organizationId,
    categoryId,
    amount,
    date,
    policy.period,
    maxAmountNumber,
  );

  if (periodExceeded) {
    // Auto-reject if period limit would be exceeded
    const expense = await ctx.db.expense.create({
      data: {
        amount,
        date,
        description,
        status: ExpenseStatus.REJECTED,
        userId,
        organizationId,
        categoryId,
        policyId: policy.id,
      },
    });

    const periodName = policy.period === PolicyPeriod.DAILY ? "daily" : "monthly";
    return {
      expenseId: expense.id,
      status: ExpenseStatus.REJECTED,
      autoApproved: false,
      rejectionReason: `Would exceed ${periodName} spending limit of $${maxAmountNumber.toFixed(2)}`,
    };
  }

  // Determine if manual review is required
  const status = policy.requiresReview ? ExpenseStatus.SUBMITTED : ExpenseStatus.APPROVED;

  // Create the expense
  const expense = await ctx.db.expense.create({
    data: {
      amount,
      date,
      description,
      status,
      userId,
      organizationId,
      categoryId,
      policyId: policy.id,
    },
  });

  return {
    expenseId: expense.id,
    status,
    autoApproved: !policy.requiresReview,
  };
}

/**
 * Checks if adding this expense would exceed period limits
 */
async function checkPeriodLimits(
  ctx: Context,
  userId: string,
  organizationId: string,
  categoryId: string,
  newAmount: number,
  expenseDate: Date,
  period: PolicyPeriod,
  maxAmount: number,
): Promise<boolean> {
  // Calculate period start date
  const periodStart = getPeriodStart(expenseDate, period);
  const periodEnd = getPeriodEnd(expenseDate, period);

  // Get existing expenses in this period for this user and category
  const existingExpenses = await ctx.db.expense.findMany({
    where: {
      userId,
      organizationId,
      categoryId,
      date: {
        gte: periodStart,
        lte: periodEnd,
      },
      status: {
        in: [ExpenseStatus.SUBMITTED, ExpenseStatus.APPROVED],
      },
    },
  });

  // Calculate total spent in period
  const totalSpent = existingExpenses.reduce(
    (sum, expense) => sum + expense.amount.toNumber(),
    0,
  );

  // Check if adding new amount would exceed limit
  return totalSpent + newAmount > maxAmount;
}

/**
 * Gets the start date for a given period
 */
function getPeriodStart(date: Date, period: PolicyPeriod): Date {
  const start = new Date(date);

  if (period === PolicyPeriod.DAILY) {
    start.setHours(0, 0, 0, 0);
  } else {
    // Monthly: start of month
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  }

  return start;
}

/**
 * Gets the end date for a given period
 */
function getPeriodEnd(date: Date, period: PolicyPeriod): Date {
  const end = new Date(date);

  if (period === PolicyPeriod.DAILY) {
    end.setHours(23, 59, 59, 999);
  } else {
    // Monthly: end of month
    end.setMonth(end.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
  }

  return end;
}
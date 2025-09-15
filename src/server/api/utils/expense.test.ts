import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyPeriod, ExpenseStatus } from "@prisma/client";
import { submitExpense } from "./expense";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("expense utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submitExpense", () => {
    it("should handle monthly period limits correctly", async () => {
      // Setup: Create user, organization, category, and monthly policy
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user.id,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const policy = await db.policy.create({
        data: {
          maxAmount: 1000.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      // Create existing expense in current month totaling $800
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      await db.expense.create({
        data: {
          amount: 800.00,
          date: startOfMonth,
          description: "Existing monthly expense",
          status: ExpenseStatus.APPROVED,
          userId: user.id,
          organizationId: organization.id,
          categoryId: category.id,
          policyId: policy.id,
        },
      });

      // Action: Submit expense that would exceed monthly limit
      const result = await submitExpense(mockContext, {
        amount: 300.00, // $800 + $300 = $1100 > $1000
        date: now,
        description: "Expense that exceeds monthly limit",
        categoryId: category.id,
        organizationId: organization.id,
        userId: user.id,
      });

      // Assertions
      expect(result.status).toBe(ExpenseStatus.REJECTED);
      expect(result.autoApproved).toBe(false);
      expect(result.rejectionReason).toContain("exceed monthly spending limit");
    });

    it("should allow expense within monthly period limits", async () => {
      // Setup: Create user, organization, category, and monthly policy
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user.id,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      await db.policy.create({
        data: {
          maxAmount: 1000.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      const now = new Date();

      // Action: Submit expense within monthly limit
      const result = await submitExpense(mockContext, {
        amount: 500.00, // Within $1000 limit
        date: now,
        description: "Expense within monthly limit",
        categoryId: category.id,
        organizationId: organization.id,
        userId: user.id,
      });

      // Assertions
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.autoApproved).toBe(true);
      expect(result.rejectionReason).toBeUndefined();
    });

    it("should handle expenses across different months separately", async () => {
      // Setup: Create user, organization, category, and monthly policy
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user.id,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const policy = await db.policy.create({
        data: {
          maxAmount: 1000.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      // Create expense in previous month totaling $900
      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      await db.expense.create({
        data: {
          amount: 900.00,
          date: lastMonth,
          description: "Last month expense",
          status: ExpenseStatus.APPROVED,
          userId: user.id,
          organizationId: organization.id,
          categoryId: category.id,
          policyId: policy.id,
        },
      });

      // Action: Submit expense in current month (should not be affected by last month's expense)
      const thisMonth = new Date();
      const result = await submitExpense(mockContext, {
        amount: 900.00, // Would exceed if combined with last month, but should be OK
        date: thisMonth,
        description: "This month expense",
        categoryId: category.id,
        organizationId: organization.id,
        userId: user.id,
      });

      // Assertions: Should be approved because it's a different month
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.autoApproved).toBe(true);
      expect(result.rejectionReason).toBeUndefined();
    });

    it("should handle different expense categories separately for period limits", async () => {
      // Setup: Create user, organization, two categories, and policies
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user.id,
        },
      });

      const travelCategory = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const mealCategory = await db.expenseCategory.create({
        data: {
          name: "Meals",
          organizationId: organization.id,
        },
      });

      const travelPolicy = await db.policy.create({
        data: {
          maxAmount: 500.00,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: travelCategory.id,
        },
      });

      const mealPolicy = await db.policy.create({
        data: {
          maxAmount: 100.00,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: mealCategory.id,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      const today = new Date();

      // Create existing travel expense for today totaling $400
      await db.expense.create({
        data: {
          amount: 400.00,
          date: today,
          description: "Existing travel expense",
          status: ExpenseStatus.APPROVED,
          userId: user.id,
          organizationId: organization.id,
          categoryId: travelCategory.id,
          policyId: travelPolicy.id,
        },
      });

      // Action: Submit meal expense (different category, should not be affected by travel expense)
      const result = await submitExpense(mockContext, {
        amount: 50.00,
        date: today,
        description: "Business lunch",
        categoryId: mealCategory.id,
        organizationId: organization.id,
        userId: user.id,
      });

      // Assertions: Should be approved because it's a different category
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.autoApproved).toBe(true);
      expect(result.rejectionReason).toBeUndefined();

      // Verify the correct policy was applied
      const expense = await db.expense.findUnique({
        where: { id: result.expenseId },
      });
      expect(expense!.policyId).toBe(mealPolicy.id);
    });

    it("should only count approved and submitted expenses for period limits", async () => {
      // Setup: Create user, organization, category, and daily policy
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user.id,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const policy = await db.policy.create({
        data: {
          maxAmount: 100.00,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      const today = new Date();

      // Create existing expenses for today:
      // - $50 approved (should count)
      // - $30 submitted (should count)
      // - $40 rejected (should NOT count)
      await Promise.all([
        db.expense.create({
          data: {
            amount: 50.00,
            date: today,
            description: "Approved expense",
            status: ExpenseStatus.APPROVED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
        db.expense.create({
          data: {
            amount: 30.00,
            date: today,
            description: "Submitted expense",
            status: ExpenseStatus.SUBMITTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
        db.expense.create({
          data: {
            amount: 40.00,
            date: today,
            description: "Rejected expense",
            status: ExpenseStatus.REJECTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
      ]);

      // Action: Submit new expense
      // Current total (excluding rejected): $50 + $30 = $80
      // New expense: $15
      // Total would be: $80 + $15 = $95 (under $100 limit)
      const result = await submitExpense(mockContext, {
        amount: 15.00,
        date: today,
        description: "New expense",
        categoryId: category.id,
        organizationId: organization.id,
        userId: user.id,
      });

      // Assertions: Should be approved because rejected expenses don't count toward limit
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.autoApproved).toBe(true);
      expect(result.rejectionReason).toBeUndefined();
    });
  });
});
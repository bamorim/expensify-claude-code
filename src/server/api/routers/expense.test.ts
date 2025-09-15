import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, PolicyPeriod, ExpenseStatus } from "@prisma/client";
import { expenseRouter } from "./expense";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("expense router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("submit", () => {
    it("should submit expense and auto-approve when policy allows", async () => {
      // Setup: Create user, organization, category, and auto-approve policy
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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
          requiresReview: false, // Auto-approve
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Submit expense within policy limit
      const result = await caller.submit({
        amount: 50.00,
        date: new Date(),
        description: "Business lunch",
        categoryId: category.id,
        organizationId: organization.id,
      });

      // Assertions
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.autoApproved).toBe(true);
      expect(result.rejectionReason).toBeUndefined();

      // Verify expense was created in database
      const expense = await db.expense.findUnique({
        where: { id: result.expenseId },
      });
      expect(expense).toBeTruthy();
      expect(expense!.amount.toNumber()).toBe(50.00);
      expect(expense!.status).toBe(ExpenseStatus.APPROVED);
      expect(expense!.policyId).toBe(policy.id);
    });

    it("should submit expense for manual review when policy requires it", async () => {
      // Setup: Create user, organization, category, and manual review policy
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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
          maxAmount: 100.00,
          period: PolicyPeriod.DAILY,
          requiresReview: true, // Manual review required
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Submit expense
      const result = await caller.submit({
        amount: 50.00,
        date: new Date(),
        description: "Business lunch",
        categoryId: category.id,
        organizationId: organization.id,
      });

      // Assertions
      expect(result.status).toBe(ExpenseStatus.SUBMITTED);
      expect(result.autoApproved).toBe(false);
      expect(result.rejectionReason).toBeUndefined();
    });

    it("should auto-reject expense that exceeds policy amount limit", async () => {
      // Setup: Create user, organization, category, and restrictive policy
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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
          maxAmount: 50.00,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Submit expense over policy limit
      const result = await caller.submit({
        amount: 100.00, // Exceeds $50 limit
        date: new Date(),
        description: "Expensive business dinner",
        categoryId: category.id,
        organizationId: organization.id,
      });

      // Assertions
      expect(result.status).toBe(ExpenseStatus.REJECTED);
      expect(result.autoApproved).toBe(false);
      expect(result.rejectionReason).toContain("exceeds policy limit");

      // Verify expense was created with rejected status
      const expense = await db.expense.findUnique({
        where: { id: result.expenseId },
      });
      expect(expense!.status).toBe(ExpenseStatus.REJECTED);
    });

    it("should auto-reject expense that would exceed daily period limit", async () => {
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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

      const today = new Date();

      // Create existing expense for today totaling $60
      await db.expense.create({
        data: {
          amount: 60.00,
          date: today,
          description: "Existing expense",
          status: ExpenseStatus.APPROVED,
          userId: user.id,
          organizationId: organization.id,
          categoryId: category.id,
          policyId: policy.id,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Submit expense that would exceed daily limit ($60 + $50 = $110 > $100)
      const result = await caller.submit({
        amount: 50.00,
        date: today,
        description: "Another expense",
        categoryId: category.id,
        organizationId: organization.id,
      });

      // Assertions
      expect(result.status).toBe(ExpenseStatus.REJECTED);
      expect(result.autoApproved).toBe(false);
      expect(result.rejectionReason).toContain("exceed daily spending limit");
    });

    it("should apply user-specific policy over organization-wide policy", async () => {
      // Setup: Create user, organization, category, organization-wide policy, and user-specific policy
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      // Organization-wide policy: $50 limit
      await db.policy.create({
        data: {
          maxAmount: 50.00,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
          userId: null, // Organization-wide
        },
      });

      // User-specific policy: $200 limit (higher than org-wide)
      const userPolicy = await db.policy.create({
        data: {
          maxAmount: 200.00,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
          organizationId: organization.id,
          categoryId: category.id,
          userId: user.id, // User-specific
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Submit expense that would be rejected by org policy but approved by user policy
      const result = await caller.submit({
        amount: 100.00, // Above org limit ($50) but below user limit ($200)
        date: new Date(),
        description: "High-value business expense",
        categoryId: category.id,
        organizationId: organization.id,
      });

      // Assertions: Should be approved using user-specific policy
      expect(result.status).toBe(ExpenseStatus.APPROVED);
      expect(result.autoApproved).toBe(true);

      // Verify the correct policy was applied
      const expense = await db.expense.findUnique({
        where: { id: result.expenseId },
      });
      expect(expense!.policyId).toBe(userPolicy.id);
    });

    it("should reject expense when no policy exists for category", async () => {
      // Setup: Create user, organization, category, but no policy
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      // No policy created for this category

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action & Assertion: Should throw error
      await expect(
        caller.submit({
          amount: 50.00,
          date: new Date(),
          description: "Business lunch",
          categoryId: category.id,
          organizationId: organization.id,
        }),
      ).rejects.toThrow("No policy found for this category");
    });

    it("should reject submission when user is not organization member", async () => {
      // Setup: Create user and organization (but no membership)
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

      // No membership created for user

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action & Assertion: Should throw authorization error
      await expect(
        caller.submit({
          amount: 50.00,
          date: new Date(),
          description: "Business lunch",
          categoryId: category.id,
          organizationId: organization.id,
        }),
      ).rejects.toThrow(TRPCError);
    });

    it("should reject submission when category does not exist", async () => {
      // Setup: Create user and organization
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action & Assertion: Should throw error for non-existent category
      await expect(
        caller.submit({
          amount: 50.00,
          date: new Date(),
          description: "Business lunch",
          categoryId: "non-existent-category-id",
          organizationId: organization.id,
        }),
      ).rejects.toThrow("Category not found");
    });
  });

  describe("list", () => {
    it("should list user's expenses with pagination", async () => {
      // Setup: Create user, organization, and expenses
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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

      // Create multiple expenses
      await Promise.all([
        db.expense.create({
          data: {
            amount: 50.00,
            date: new Date(),
            description: "Expense 1",
            status: ExpenseStatus.APPROVED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
        db.expense.create({
          data: {
            amount: 75.00,
            date: new Date(),
            description: "Expense 2",
            status: ExpenseStatus.SUBMITTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
      ]);

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: List expenses
      const result = await caller.list({
        organizationId: organization.id,
      });

      // Assertions
      expect(result.expenses).toHaveLength(2);
      expect(typeof result.expenses[0]?.amount).toBe('number');
      expect(result.expenses[0]?.category).toBeTruthy();
      expect(result.expenses[0]?.policy).toBeTruthy();
    });

    it("should filter expenses by status", async () => {
      // Setup: Create user, organization, and expenses with different statuses
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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

      // Create expenses with different statuses
      await Promise.all([
        db.expense.create({
          data: {
            amount: 50.00,
            date: new Date(),
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
            amount: 75.00,
            date: new Date(),
            description: "Pending expense",
            status: ExpenseStatus.SUBMITTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
        db.expense.create({
          data: {
            amount: 25.00,
            date: new Date(),
            description: "Rejected expense",
            status: ExpenseStatus.REJECTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
          },
        }),
      ]);

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: List only approved expenses
      const result = await caller.list({
        organizationId: organization.id,
        status: ExpenseStatus.APPROVED,
      });

      // Assertions
      expect(result.expenses).toHaveLength(1);
      expect(result.expenses[0]?.status).toBe(ExpenseStatus.APPROVED);
      expect(result.expenses[0]?.description).toBe("Approved expense");
    });
  });

  describe("getById", () => {
    it("should return expense details for user's own expense", async () => {
      // Setup: Create user, organization, and expense
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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

      const expense = await db.expense.create({
        data: {
          amount: 50.00,
          date: new Date(),
          description: "Business lunch",
          status: ExpenseStatus.APPROVED,
          userId: user.id,
          organizationId: organization.id,
          categoryId: category.id,
          policyId: policy.id,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Get expense by ID
      const result = await caller.getById({
        id: expense.id,
        organizationId: organization.id,
      });

      // Assertions
      expect(result.id).toBe(expense.id);
      expect(result.amount).toBe(50.00);
      expect(result.description).toBe("Business lunch");
      expect(result.category).toBeTruthy();
      expect(result.policy).toBeTruthy();
    });

    it("should reject access to other user's expense", async () => {
      // Setup: Create two users and organization
      const user1 = await db.user.create({
        data: {
          name: "User 1",
          email: faker.internet.email(),
        },
      });

      const user2 = await db.user.create({
        data: {
          name: "User 2",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user1.id,
        },
      });

      // Both users are members
      await Promise.all([
        db.membership.create({
          data: {
            userId: user1.id,
            organizationId: organization.id,
            role: Role.MEMBER,
          },
        }),
        db.membership.create({
          data: {
            userId: user2.id,
            organizationId: organization.id,
            role: Role.MEMBER,
          },
        }),
      ]);

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

      // Create expense belonging to user1
      const expense = await db.expense.create({
        data: {
          amount: 50.00,
          date: new Date(),
          description: "User 1's expense",
          status: ExpenseStatus.APPROVED,
          userId: user1.id,
          organizationId: organization.id,
          categoryId: category.id,
          policyId: policy.id,
        },
      });

      // User2 tries to access user1's expense
      const mockSession = {
        user: { id: user2.id },
        expires: new Date().toISOString(),
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action & Assertion: Should throw not found error
      await expect(
        caller.getById({
          id: expense.id,
          organizationId: organization.id,
        }),
      ).rejects.toThrow("Expense not found");
    });
  });

  describe("getStats", () => {
    it("should return accurate expense statistics for user", async () => {
      // Setup: Create user, organization, and various expenses
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

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
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

      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 15); // Mid-month
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);

      // Create expenses with various statuses and dates
      await Promise.all([
        // This month - approved
        db.expense.create({
          data: {
            amount: 100.00,
            date: thisMonth,
            description: "This month approved",
            status: ExpenseStatus.APPROVED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
            createdAt: thisMonth,
          },
        }),
        // This month - pending
        db.expense.create({
          data: {
            amount: 50.00,
            date: thisMonth,
            description: "This month pending",
            status: ExpenseStatus.SUBMITTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
            createdAt: thisMonth,
          },
        }),
        // Last month - approved
        db.expense.create({
          data: {
            amount: 75.00,
            date: lastMonth,
            description: "Last month approved",
            status: ExpenseStatus.APPROVED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
            createdAt: lastMonth,
          },
        }),
        // Rejected expense
        db.expense.create({
          data: {
            amount: 25.00,
            date: thisMonth,
            description: "Rejected expense",
            status: ExpenseStatus.REJECTED,
            userId: user.id,
            organizationId: organization.id,
            categoryId: category.id,
            policyId: policy.id,
            createdAt: thisMonth,
          },
        }),
      ]);

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = expenseRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Action: Get stats
      const result = await caller.getStats({
        organizationId: organization.id,
      });

      // Assertions
      expect(result.allTime.totalCount).toBe(4); // All expenses
      expect(result.allTime.approvedCount).toBe(2); // Two approved expenses
      expect(result.allTime.approvedAmount).toBe(175.00); // 100 + 75
      expect(result.allTime.pendingCount).toBe(1); // One pending expense
      expect(result.allTime.pendingAmount).toBe(50.00); // 50
      expect(result.allTime.rejectedCount).toBe(1); // One rejected expense
      expect(result.allTime.rejectedAmount).toBe(25.00); // 25

      expect(result.thisMonth.totalCount).toBe(3); // Three expenses created this month
      expect(result.thisMonth.approvedCount).toBe(1); // One approved this month
      expect(result.thisMonth.approvedAmount).toBe(100.00); // 100
      expect(result.thisMonth.pendingCount).toBe(1); // One pending this month
      expect(result.thisMonth.pendingAmount).toBe(50.00); // 50
      expect(result.thisMonth.rejectedCount).toBe(1); // One rejected this month
      expect(result.thisMonth.rejectedAmount).toBe(25.00); // 25
    });
  });
});
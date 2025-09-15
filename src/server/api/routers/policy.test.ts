import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, PolicyPeriod } from "@prisma/client";
import { policyRouter } from "./policy";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("policy router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create organization-wide policy when user is admin", async () => {
      // Setup: Create admin user, organization, and category
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({
        organizationId: organization.id,
        categoryId: category.id,
        maxAmount: 500.00,
        period: PolicyPeriod.MONTHLY,
        requiresReview: false,
      });

      expect(result.maxAmount.toNumber()).toBe(500.00);
      expect(result.period).toBe(PolicyPeriod.MONTHLY);
      expect(result.requiresReview).toBe(false);
      expect(result.organizationId).toBe(organization.id);
      expect(result.categoryId).toBe(category.id);
      expect(result.userId).toBeNull();
    });

    it("should create user-specific policy when user is admin", async () => {
      // Setup
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const member = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      await db.membership.create({
        data: {
          userId: member.id,
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

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({
        organizationId: organization.id,
        categoryId: category.id,
        userId: member.id,
        maxAmount: 1000.00,
        period: PolicyPeriod.DAILY,
        requiresReview: true,
      });

      expect(result.maxAmount.toNumber()).toBe(1000.00);
      expect(result.period).toBe(PolicyPeriod.DAILY);
      expect(result.requiresReview).toBe(true);
      expect(result.userId).toBe(member.id);
    });

    it("should throw error when user is not admin", async () => {
      const member = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: member.id,
        },
      });

      await db.membership.create({
        data: {
          userId: member.id,
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

      const mockSession = {
        user: member,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when category does not exist", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          categoryId: "non-existent-category",
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when policy already exists", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      // Create existing policy
      await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 300.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("update", () => {
    it("should update policy when user is admin", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
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
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.update({
        id: policy.id,
        maxAmount: 750.00,
        period: PolicyPeriod.DAILY,
        requiresReview: true,
      });

      expect(result.maxAmount.toNumber()).toBe(750.00);
      expect(result.period).toBe(PolicyPeriod.DAILY);
      expect(result.requiresReview).toBe(true);
    });

    it("should throw error when policy not found", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.update({
          id: "non-existent-id",
          maxAmount: 750.00,
          period: PolicyPeriod.DAILY,
          requiresReview: true,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("delete", () => {
    it("should delete policy when user is admin", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
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
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.delete({ id: policy.id });

      expect(result.success).toBe(true);

      // Verify policy was deleted
      const deletedPolicy = await db.policy.findUnique({
        where: { id: policy.id },
      });
      expect(deletedPolicy).toBeNull();
    });
  });

  describe("listForOrganization", () => {
    it("should return all policies for organization members", async () => {
      const member = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: member.id,
        },
      });

      await db.membership.create({
        data: {
          userId: member.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const category1 = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const category2 = await db.expenseCategory.create({
        data: {
          name: "Food",
          organizationId: organization.id,
        },
      });

      // Create policies
      await db.policy.createMany({
        data: [
          {
            organizationId: organization.id,
            categoryId: category1.id,
            maxAmount: 500.00,
            period: PolicyPeriod.MONTHLY,
            requiresReview: false,
          },
          {
            organizationId: organization.id,
            categoryId: category2.id,
            maxAmount: 100.00,
            period: PolicyPeriod.DAILY,
            requiresReview: true,
          },
          {
            organizationId: organization.id,
            categoryId: category1.id,
            userId: member.id,
            maxAmount: 750.00,
            period: PolicyPeriod.MONTHLY,
            requiresReview: false,
          },
        ],
      });

      const mockSession = {
        user: member,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.listForOrganization({
        organizationId: organization.id,
      });

      expect(result).toHaveLength(3);
      // Check that policies are sorted by category name first
      expect(result[0]?.category.name).toBe("Food");
      expect(result[1]?.category.name).toBe("Travel");
      expect(result[2]?.category.name).toBe("Travel");
    });

    it("should only return relevant policies for non-admin members", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const member1 = await db.user.create({
        data: {
          name: "Member 1",
          email: faker.internet.email(),
        },
      });

      const member2 = await db.user.create({
        data: {
          name: "Member 2",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      await db.membership.create({
        data: {
          userId: member1.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      await db.membership.create({
        data: {
          userId: member2.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const category1 = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const category2 = await db.expenseCategory.create({
        data: {
          name: "Food",
          organizationId: organization.id,
        },
      });

      // Create organization-wide policy
      const orgPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category1.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      // Create policy for member1
      const member1Policy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category2.id,
          userId: member1.id,
          maxAmount: 100.00,
          period: PolicyPeriod.DAILY,
          requiresReview: true,
        },
      });

      // Create policy for member2 (member1 shouldn't see this)
      await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category1.id,
          userId: member2.id,
          maxAmount: 750.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const member1Session = {
        user: member1,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: member1Session,
        headers: new Headers(),
      });

      const result = await caller.listForOrganization({
        organizationId: organization.id,
      });

      // Member1 should only see org-wide policy and their own policy
      expect(result).toHaveLength(2);
      const policyIds = result.map(p => p.id);
      expect(policyIds).toContain(orgPolicy.id);
      expect(policyIds).toContain(member1Policy.id);
      // Should NOT contain member2's policy
      expect(result.find(p => p.userId === member2.id)).toBeUndefined();
    });
  });

  describe("getEffectivePolicy", () => {
    it("should return user-specific policy when it exists", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const member = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      await db.membership.create({
        data: {
          userId: member.id,
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

      // Create organization-wide policy
      await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      // Create user-specific policy (should take precedence)
      const userPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          userId: member.id,
          maxAmount: 1000.00,
          period: PolicyPeriod.DAILY,
          requiresReview: true,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getEffectivePolicy({
        organizationId: organization.id,
        categoryId: category.id,
        userId: member.id,
      });

      expect(result.policy?.id).toBe(userPolicy.id);
      expect(result.policy?.maxAmount.toNumber()).toBe(1000.00);
      expect(result.policyType).toBe("user-specific");
    });

    it("should return organization-wide policy when no user-specific policy exists", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const member = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      await db.membership.create({
        data: {
          userId: member.id,
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

      // Create only organization-wide policy
      const orgPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.00,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getEffectivePolicy({
        organizationId: organization.id,
        categoryId: category.id,
        userId: member.id,
      });

      expect(result.policy?.id).toBe(orgPolicy.id);
      expect(result.policy?.maxAmount.toNumber()).toBe(500.00);
      expect(result.policyType).toBe("organization-wide");
    });

    it("should return null when no policy exists", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const member = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: admin.id,
        },
      });

      await db.membership.create({
        data: {
          userId: admin.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      await db.membership.create({
        data: {
          userId: member.id,
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

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getEffectivePolicy({
        organizationId: organization.id,
        categoryId: category.id,
        userId: member.id,
      });

      expect(result.policy).toBeNull();
      expect(result.policyType).toBe("organization-wide");
    });

    it("should throw error when non-admin tries to query another user's effective policy", async () => {
      const member1 = await db.user.create({
        data: {
          name: "Member 1",
          email: faker.internet.email(),
        },
      });

      const member2 = await db.user.create({
        data: {
          name: "Member 2",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: member1.id,
        },
      });

      await db.membership.create({
        data: {
          userId: member1.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      await db.membership.create({
        data: {
          userId: member2.id,
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

      const member1Session = {
        user: member1,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: member1Session,
        headers: new Headers(),
      });

      // Member1 should not be able to query member2's effective policy
      await expect(
        caller.getEffectivePolicy({
          organizationId: organization.id,
          categoryId: category.id,
          userId: member2.id,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when non-admin tries to query another user's policies via listForUser", async () => {
      const member1 = await db.user.create({
        data: {
          name: "Member 1",
          email: faker.internet.email(),
        },
      });

      const member2 = await db.user.create({
        data: {
          name: "Member 2",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: member1.id,
        },
      });

      await db.membership.create({
        data: {
          userId: member1.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      await db.membership.create({
        data: {
          userId: member2.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const member1Session = {
        user: member1,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = policyRouter.createCaller({
        db: db,
        session: member1Session,
        headers: new Headers(),
      });

      // Member1 should not be able to query member2's policies
      await expect(
        caller.listForUser({
          organizationId: organization.id,
          userId: member2.id,
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});
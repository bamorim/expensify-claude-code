import { beforeEach, describe, expect, it, vi } from "vitest";
import { PolicyPeriod } from "@prisma/client";
import { getPolicyForUserAndCategory } from "./policy";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

describe("policy resolution utility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPolicyForUserAndCategory", () => {
    it("should return user-specific policy when it exists", async () => {
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

      // Create organization-wide policy
      await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.0,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      // Create user-specific policy (should take precedence)
      const userPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          userId: user.id,
          maxAmount: 1000.0,
          period: PolicyPeriod.DAILY,
          requiresReview: true,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      const result = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
        user.id,
      );

      expect(result?.id).toBe(userPolicy.id);
      expect(result?.maxAmount.toNumber()).toBe(1000.0);
      expect(result?.userId).toBe(user.id);
    });

    it("should return organization-wide policy when user-specific policy does not exist", async () => {
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

      // Create only organization-wide policy
      const orgPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.0,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      const result = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
        user.id,
      );

      expect(result?.id).toBe(orgPolicy.id);
      expect(result?.maxAmount.toNumber()).toBe(500.0);
      expect(result?.userId).toBeNull();
    });

    it("should return organization-wide policy when no userId provided", async () => {
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

      // Create user-specific policy
      await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          userId: user.id,
          maxAmount: 1000.0,
          period: PolicyPeriod.DAILY,
          requiresReview: true,
        },
      });

      // Create organization-wide policy
      const orgPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.0,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      // Don't provide userId - should return org-wide policy
      const result = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
      );

      expect(result?.id).toBe(orgPolicy.id);
      expect(result?.maxAmount.toNumber()).toBe(500.0);
      expect(result?.userId).toBeNull();
    });

    it("should return null when no policies exist", async () => {
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

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      const result = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
        user.id,
      );

      expect(result).toBeNull();
    });

    it("should correctly handle policy precedence with multiple policies", async () => {
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

      const category = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      // Create organization-wide policy
      const orgPolicy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          maxAmount: 500.0,
          period: PolicyPeriod.MONTHLY,
          requiresReview: false,
        },
      });

      // Create user-specific policy for user1
      const user1Policy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          userId: user1.id,
          maxAmount: 1000.0,
          period: PolicyPeriod.DAILY,
          requiresReview: true,
        },
      });

      // Create user-specific policy for user2
      const user2Policy = await db.policy.create({
        data: {
          organizationId: organization.id,
          categoryId: category.id,
          userId: user2.id,
          maxAmount: 250.0,
          period: PolicyPeriod.DAILY,
          requiresReview: false,
        },
      });

      const mockContext = {
        db: db,
        session: null,
        headers: new Headers(),
      };

      // Test user1 gets their specific policy
      const result1 = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
        user1.id,
      );
      expect(result1?.id).toBe(user1Policy.id);
      expect(result1?.maxAmount.toNumber()).toBe(1000.0);

      // Test user2 gets their specific policy
      const result2 = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
        user2.id,
      );
      expect(result2?.id).toBe(user2Policy.id);
      expect(result2?.maxAmount.toNumber()).toBe(250.0);

      // Test organization-wide policy is returned when no user specified
      const resultOrg = await getPolicyForUserAndCategory(
        mockContext,
        organization.id,
        category.id,
      );
      expect(resultOrg?.id).toBe(orgPolicy.id);
      expect(resultOrg?.maxAmount.toNumber()).toBe(500.0);
    });
  });
});


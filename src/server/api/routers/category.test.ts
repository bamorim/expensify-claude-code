import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role } from "@prisma/client";
import { categoryRouter } from "./category";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("category router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create category when user is admin", async () => {
      // Setup: Create admin user and organization
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

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({
        organizationId: organization.id,
        name: "Travel",
        description: "Travel expenses",
      });

      expect(result.name).toBe("Travel");
      expect(result.description).toBe("Travel expenses");
      expect(result.organizationId).toBe(organization.id);
    });

    it("should throw error when user is not admin", async () => {
      // Setup: Create member user (not admin)
      const user = await db.user.create({
        data: {
          name: "Member User",
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
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          name: "Travel",
          description: "Travel expenses",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when category name already exists", async () => {
      // Setup
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

      // Create existing category
      await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          name: "Travel",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should create category without description", async () => {
      // Setup
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

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({
        organizationId: organization.id,
        name: "Office Supplies",
      });

      expect(result.name).toBe("Office Supplies");
      expect(result.description).toBeNull();
      expect(result.organizationId).toBe(organization.id);
    });
  });

  describe("update", () => {
    it("should update category when user is admin", async () => {
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
          description: "Travel expenses",
          organizationId: organization.id,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.update({
        id: category.id,
        name: "Business Travel",
        description: "Updated travel expenses",
      });

      expect(result.name).toBe("Business Travel");
      expect(result.description).toBe("Updated travel expenses");
    });

    it("should throw error when category not found", async () => {
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

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.update({
          id: "non-existent-id",
          name: "Updated Name",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when new name conflicts with existing category", async () => {
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

      // Create two categories
      const category1 = await db.expenseCategory.create({
        data: {
          name: "Travel",
          organizationId: organization.id,
        },
      });

      await db.expenseCategory.create({
        data: {
          name: "Food",
          organizationId: organization.id,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      // Try to rename Travel to Food (should conflict)
      await expect(
        caller.update({
          id: category1.id,
          name: "Food",
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("delete", () => {
    it("should delete category when user is admin", async () => {
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

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.delete({ id: category.id });

      expect(result.success).toBe(true);

      // Verify category was deleted
      const deletedCategory = await db.expenseCategory.findUnique({
        where: { id: category.id },
      });
      expect(deletedCategory).toBeNull();
    });

    it("should throw error when category not found", async () => {
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

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.delete({ id: "non-existent-id" })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("list", () => {
    it("should return categories for organization members", async () => {
      const user = await db.user.create({
        data: {
          name: "Member User",
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

      // Create some categories
      await db.expenseCategory.createMany({
        data: [
          {
            name: "Travel",
            description: "Travel expenses",
            organizationId: organization.id,
          },
          {
            name: "Food",
            organizationId: organization.id,
          },
          {
            name: "Office Supplies",
            organizationId: organization.id,
          },
        ],
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.list({ organizationId: organization.id });

      expect(result).toHaveLength(3);
      expect(result.map(c => c.name)).toContain("Travel");
      expect(result.map(c => c.name)).toContain("Food");
      expect(result.map(c => c.name)).toContain("Office Supplies");

      // Should be sorted by name
      expect(result[0]?.name).toBe("Food");
      expect(result[1]?.name).toBe("Office Supplies");
      expect(result[2]?.name).toBe("Travel");
    });

    it("should return empty array when no categories exist", async () => {
      const user = await db.user.create({
        data: {
          name: "Member User",
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
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.list({ organizationId: organization.id });

      expect(result).toEqual([]);
    });

    it("should throw error when user is not organization member", async () => {
      const user = await db.user.create({
        data: {
          name: "Non-member User",
          email: faker.internet.email(),
        },
      });

      const otherUser = await db.user.create({
        data: {
          name: "Other User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: otherUser.id,
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.list({ organizationId: organization.id })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("getById", () => {
    it("should return category when user is organization member", async () => {
      const user = await db.user.create({
        data: {
          name: "Member User",
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
          description: "Travel expenses",
          organizationId: organization.id,
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getById({ id: category.id });

      expect(result.id).toBe(category.id);
      expect(result.name).toBe("Travel");
      expect(result.description).toBe("Travel expenses");
    });

    it("should throw error when category not found", async () => {
      const user = await db.user.create({
        data: {
          name: "Member User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = categoryRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.getById({ id: "non-existent-id" })
      ).rejects.toThrow(TRPCError);
    });
  });
});
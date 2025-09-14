import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { organizationRouter } from "./organization";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { Role } from "@prisma/client";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("OrganizationRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create an organization and make creator an admin", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({ name: "Test Organization" });

      expect(result.name).toEqual("Test Organization");
      expect(result.createdById).toEqual(user.id);
      expect(result.memberships).toHaveLength(1);
      expect(result.memberships[0]?.role).toEqual(Role.ADMIN);
      expect(result.memberships[0]?.userId).toEqual(user.id);

      // Verify organization exists in database
      const organization = await db.organization.findUnique({
        where: { id: result.id },
      });
      expect(organization).toBeDefined();

      // Verify membership exists in database
      const membership = await db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: result.id,
          },
        },
      });
      expect(membership).toBeDefined();
      expect(membership?.role).toEqual(Role.ADMIN);
    });

    it("should require authentication", async () => {
      const caller = organizationRouter.createCaller({
        db: db,
        session: null,
        headers: new Headers(),
      });

      await expect(caller.create({ name: "Test Organization" })).rejects.toThrow(
        TRPCError
      );
    });
  });

  describe("list", () => {
    it("should return user's organizations with role info", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const organization1 = await db.organization.create({
        data: {
          name: "Org 1",
          createdById: user.id,
        },
      });

      const organization2 = await db.organization.create({
        data: {
          name: "Org 2",
          createdById: user.id,
        },
      });

      await db.membership.createMany({
        data: [
          {
            userId: user.id,
            organizationId: organization1.id,
            role: Role.ADMIN,
          },
          {
            userId: user.id,
            organizationId: organization2.id,
            role: Role.MEMBER,
          },
        ],
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.list();

      expect(result).toHaveLength(2);
      expect(result.map(org => org.name)).toContain("Org 1");
      expect(result.map(org => org.name)).toContain("Org 2");

      const org1 = result.find(org => org.name === "Org 1");
      const org2 = result.find(org => org.name === "Org 2");

      expect(org1?.userRole).toEqual(Role.ADMIN);
      expect(org2?.userRole).toEqual(Role.MEMBER);
    });

    it("should return empty array if user has no organizations", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.list();

      expect(result).toEqual([]);
    });
  });

  describe("getById", () => {
    it("should return organization details for members", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const creator = await db.user.create({
        data: {
          name: "Creator",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: creator.id,
        },
      });

      await db.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      await db.membership.create({
        data: {
          userId: creator.id,
          organizationId: organization.id,
          role: Role.ADMIN,
        },
      });

      const mockSession = {
        user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.getById({ id: organization.id });

      expect(result.id).toEqual(organization.id);
      expect(result.name).toEqual("Test Organization");
      expect(result.userRole).toEqual(Role.MEMBER);
      expect(result.createdBy.id).toEqual(creator.id);
      expect(result.memberships).toHaveLength(2);
    });

    it("should throw NOT_FOUND for non-members", async () => {
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

      const nonMember = await db.user.create({
        data: {
          name: "Non Member",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: nonMember,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(caller.getById({ id: organization.id })).rejects.toThrow(
        TRPCError
      );
    });
  });

  describe("update", () => {
    it("should allow admins to update organization", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Original Name",
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

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.update({
        id: organization.id,
        name: "Updated Name",
      });

      expect(result.name).toEqual("Updated Name");
      expect(result.userRole).toEqual(Role.ADMIN);

      // Verify update in database
      const updatedOrganization = await db.organization.findUnique({
        where: { id: organization.id },
      });
      expect(updatedOrganization?.name).toEqual("Updated Name");
    });

    it("should forbid non-admins from updating organization", async () => {
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
          name: "Original Name",
          createdById: admin.id,
        },
      });

      await db.membership.createMany({
        data: [
          {
            userId: admin.id,
            organizationId: organization.id,
            role: Role.ADMIN,
          },
          {
            userId: member.id,
            organizationId: organization.id,
            role: Role.MEMBER,
          },
        ],
      });

      const mockSession = {
        user: member,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.update({
          id: organization.id,
          name: "Hacked Name",
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should forbid non-members from updating organization", async () => {
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const nonMember = await db.user.create({
        data: {
          name: "Non Member",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Original Name",
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
        user: nonMember,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = organizationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.update({
          id: organization.id,
          name: "Hacked Name",
        })
      ).rejects.toThrow(TRPCError);
    });
  });
});
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Role, InvitationStatus } from "@prisma/client";
import { invitationRouter } from "./invitation";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { TRPCError } from "@trpc/server";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

// Mock the auth module
vi.mock("~/server/auth", () => ({
  auth: vi.fn(),
}));

describe("invitation router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create", () => {
    it("should create invitation when user is admin", async () => {
      // Setup: Create user, organization, and admin membership
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

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.create({
        organizationId: organization.id,
        email: "newuser@example.com",
        role: Role.MEMBER,
      });

      expect(result.email).toBe("newuser@example.com");
      expect(result.role).toBe(Role.MEMBER);
      expect(result.status).toBe(InvitationStatus.PENDING);
      expect(result.organizationId).toBe(organization.id);
      expect(result.invitedById).toBe(admin.id);
    });

    it("should throw error when user is not admin", async () => {
      // Setup: Create user as member (not admin)
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

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          email: "newuser@example.com",
          role: Role.MEMBER,
        })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when user is already a member", async () => {
      // Setup
      const admin = await db.user.create({
        data: {
          name: "Admin User",
          email: faker.internet.email(),
        },
      });

      const existingUser = await db.user.create({
        data: {
          name: "Existing User",
          email: "existing@example.com",
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
          userId: existingUser.id,
          organizationId: organization.id,
          role: Role.MEMBER,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.create({
          organizationId: organization.id,
          email: existingUser.email!,
          role: Role.MEMBER,
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("listPendingForUser", () => {
    it("should return pending invitations for user's email", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: "test@example.com",
        },
      });

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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.invitation.create({
        data: {
          email: user.email!,
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.listPendingForUser();

      expect(result).toHaveLength(1);
      expect(result[0]?.email).toBe(user.email);
      expect(result[0]?.status).toBe(InvitationStatus.PENDING);
    });

    it("should not return expired invitations", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: "test@example.com",
        },
      });

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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Already expired

      await db.invitation.create({
        data: {
          email: user.email!,
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.listPendingForUser();

      expect(result).toHaveLength(0);
    });
  });

  describe("accept", () => {
    it("should accept valid invitation and create membership", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: "test@example.com",
        },
      });

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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await db.invitation.create({
        data: {
          email: user.email!,
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
          token: "test-token",
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.accept({ token: invitation.token });

      expect(result.membership.userId).toBe(user.id);
      expect(result.membership.organizationId).toBe(organization.id);
      expect(result.membership.role).toBe(Role.MEMBER);
      expect(result.organization.id).toBe(organization.id);

      // Verify invitation status was updated
      const updatedInvitation = await db.invitation.findUnique({
        where: { id: invitation.id },
      });
      expect(updatedInvitation?.status).toBe(InvitationStatus.ACCEPTED);
    });

    it("should throw error for invalid token", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: faker.internet.email(),
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.accept({ token: "invalid-token" })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error for expired invitation", async () => {
      const user = await db.user.create({
        data: {
          name: "Test User",
          email: "test@example.com",
        },
      });

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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() - 1); // Already expired

      const invitation = await db.invitation.create({
        data: {
          email: user.email!,
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
          token: "expired-token",
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.accept({ token: invitation.token })
      ).rejects.toThrow(TRPCError);
    });

    it("should throw error when email doesn't match", async () => {
      const invitedUser = await db.user.create({
        data: {
          name: "Invited User",
          email: "invited@example.com",
        },
      });

      const differentUser = await db.user.create({
        data: {
          name: "Different User",
          email: "different@example.com",
        },
      });

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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = await db.invitation.create({
        data: {
          email: invitedUser.email!,
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
          token: "test-token",
        },
      });

      const mockSession = {
        user: differentUser,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.accept({ token: invitation.token })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe("listForOrg", () => {
    it("should list all invitations for organization when user is admin", async () => {
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

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      await db.invitation.create({
        data: {
          email: "user1@example.com",
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
        },
      });

      await db.invitation.create({
        data: {
          email: "user2@example.com",
          role: Role.ADMIN,
          status: InvitationStatus.ACCEPTED,
          organizationId: organization.id,
          invitedById: admin.id,
          expiresAt,
        },
      });

      const mockSession = {
        user: admin,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      const result = await caller.listForOrg({
        organizationId: organization.id,
      });

      expect(result).toHaveLength(2);
      expect(result.map(i => i.email)).toContain("user1@example.com");
      expect(result.map(i => i.email)).toContain("user2@example.com");
    });

    it("should throw error when user is not admin", async () => {
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
          role: Role.MEMBER, // Not admin
        },
      });

      const mockSession = {
        user: user,
        expires: "2030-12-31T23:59:59.999Z",
      };

      const caller = invitationRouter.createCaller({
        db: db,
        session: mockSession,
        headers: new Headers(),
      });

      await expect(
        caller.listForOrg({ organizationId: organization.id })
      ).rejects.toThrow(TRPCError);
    });
  });
});
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";
import { requireOrgMembership, requireOrgAdmin } from "./auth";
import { db } from "~/server/db";
import { faker } from "@faker-js/faker";
import { Role } from "@prisma/client";
import type { Context } from "~/server/api/trpc";

// Mock the database to use the transactional testing wrapper
vi.mock("~/server/db");

describe("Authorization Utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("requireOrgMembership", () => {
    it("should return role for valid organization member", async () => {
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

      const ctx: Context = {
        db,
        session: {
          user,
          expires: "2030-12-31T23:59:59.999Z",
        },
        headers: new Headers(),
      };

      const result = await requireOrgMembership(ctx, organization.id);

      expect(result.role).toEqual(Role.MEMBER);
    });

    it("should return ADMIN role for organization admin", async () => {
      const user = await db.user.create({
        data: {
          name: "Admin User",
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
          role: Role.ADMIN,
        },
      });

      const ctx: Context = {
        db,
        session: {
          user,
          expires: "2030-12-31T23:59:59.999Z",
        },
        headers: new Headers(),
      };

      const result = await requireOrgMembership(ctx, organization.id);

      expect(result.role).toEqual(Role.ADMIN);
    });

    it("should throw UNAUTHORIZED for unauthenticated users", async () => {
      const ctx: Context = {
        db,
        session: null,
        headers: new Headers(),
      };

      await expect(
        requireOrgMembership(ctx, "any-org-id")
      ).rejects.toThrow(TRPCError);

      try {
        await requireOrgMembership(ctx, "any-org-id");
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("UNAUTHORIZED");
        expect((error as TRPCError).message).toBe(
          "You must be logged in to access this organization"
        );
      }
    });

    it("should throw FORBIDDEN for non-members", async () => {
      const user = await db.user.create({
        data: {
          name: "Non Member",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: user.id,
        },
      });

      const ctx: Context = {
        db,
        session: {
          user,
          expires: "2030-12-31T23:59:59.999Z",
        },
        headers: new Headers(),
      };

      await expect(
        requireOrgMembership(ctx, organization.id)
      ).rejects.toThrow(TRPCError);

      try {
        await requireOrgMembership(ctx, organization.id);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe(
          "You are not a member of this organization"
        );
      }
    });
  });

  describe("requireOrgAdmin", () => {
    it("should pass for organization admins", async () => {
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

      const ctx: Context = {
        db,
        session: {
          user: admin,
          expires: "2030-12-31T23:59:59.999Z",
        },
        headers: new Headers(),
      };

      // Should not throw
      await expect(requireOrgAdmin(ctx, organization.id)).resolves.toBeUndefined();
    });

    it("should throw FORBIDDEN for non-admin members", async () => {
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

      const ctx: Context = {
        db,
        session: {
          user,
          expires: "2030-12-31T23:59:59.999Z",
        },
        headers: new Headers(),
      };

      await expect(requireOrgAdmin(ctx, organization.id)).rejects.toThrow(
        TRPCError
      );

      try {
        await requireOrgAdmin(ctx, organization.id);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe("FORBIDDEN");
        expect((error as TRPCError).message).toBe(
          "You must be an organization admin to perform this action"
        );
      }
    });

    it("should throw FORBIDDEN for non-members", async () => {
      const nonMember = await db.user.create({
        data: {
          name: "Non Member",
          email: faker.internet.email(),
        },
      });

      const organization = await db.organization.create({
        data: {
          name: "Test Organization",
          createdById: nonMember.id,
        },
      });

      const ctx: Context = {
        db,
        session: {
          user: nonMember,
          expires: "2030-12-31T23:59:59.999Z",
        },
        headers: new Headers(),
      };

      await expect(requireOrgAdmin(ctx, organization.id)).rejects.toThrow(
        TRPCError
      );
    });

    it("should throw UNAUTHORIZED for unauthenticated users", async () => {
      const ctx: Context = {
        db,
        session: null,
        headers: new Headers(),
      };

      await expect(requireOrgAdmin(ctx, "any-org-id")).rejects.toThrow(
        TRPCError
      );
    });
  });
});
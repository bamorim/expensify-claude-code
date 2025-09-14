import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
  type Context,
} from "~/server/api/trpc";
import { Role, InvitationStatus } from "@prisma/client";
import { requireOrgAdmin } from "~/server/api/utils/auth";

export const invitationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({
      organizationId: z.string(),
      email: z.string().email(),
      role: z.enum([Role.ADMIN, Role.MEMBER]).default(Role.MEMBER)
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.organizationId);

      // Check if user is already a member
      const existingMembership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: await getUserIdByEmail(ctx, input.email),
            organizationId: input.organizationId,
          },
        },
      });

      if (existingMembership) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User is already a member of this organization",
        });
      }

      // Check if there's already a pending invitation
      const existingInvitation = await ctx.db.invitation.findUnique({
        where: {
          email_organizationId: {
            email: input.email,
            organizationId: input.organizationId,
          },
        },
      });

      if (existingInvitation && existingInvitation.status === InvitationStatus.PENDING) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "There is already a pending invitation for this email",
        });
      }

      // Create or update invitation
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiration

      const invitation = await ctx.db.invitation.upsert({
        where: {
          email_organizationId: {
            email: input.email,
            organizationId: input.organizationId,
          },
        },
        update: {
          role: input.role,
          status: InvitationStatus.PENDING,
          expiresAt,
          invitedById: ctx.session.user.id,
        },
        create: {
          email: input.email,
          role: input.role,
          organizationId: input.organizationId,
          invitedById: ctx.session.user.id,
          expiresAt,
        },
        include: {
          organization: {
            select: {
              name: true,
            },
          },
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      });

      // Log invitation link to console for development
      const invitationLink = `${process.env.NEXTAUTH_URL}/invite/${invitation.token}`;
      console.log(`
🔗 INVITATION LINK
Email: ${invitation.email}
Organization: ${invitation.organization.name}
Role: ${invitation.role}
Invited by: ${invitation.invitedBy.name} (${invitation.invitedBy.email})
Link: ${invitationLink}
Expires: ${invitation.expiresAt.toLocaleString()}
      `);

      return invitation;
    }),

  listPendingForUser: protectedProcedure
    .query(async ({ ctx }) => {
      if (!ctx.session.user.email) {
        return [];
      }

      const invitations = await ctx.db.invitation.findMany({
        where: {
          email: ctx.session.user.email,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          organization: {
            select: {
              id: true,
              name: true,
            },
          },
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return invitations;
    }),

  accept: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.db.invitation.findUnique({
        where: { token: input.token },
        include: {
          organization: true,
        },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.status !== InvitationStatus.PENDING) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation is no longer pending",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has expired",
        });
      }

      if (invitation.email !== ctx.session.user.email) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This invitation is not for your email address",
        });
      }

      // Check if user is already a member
      const existingMembership = await ctx.db.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: ctx.session.user.id,
            organizationId: invitation.organizationId,
          },
        },
      });

      if (existingMembership) {
        // Update invitation status and return existing membership
        await ctx.db.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED },
        });

        throw new TRPCError({
          code: "CONFLICT",
          message: "You are already a member of this organization",
        });
      }

      // Create membership and update invitation in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        const membership = await tx.membership.create({
          data: {
            userId: ctx.session.user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED },
        });

        return membership;
      });

      return {
        membership: result,
        organization: invitation.organization,
      };
    }),

  listForOrg: protectedProcedure
    .input(z.object({ organizationId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.organizationId);

      const invitations = await ctx.db.invitation.findMany({
        where: {
          organizationId: input.organizationId,
        },
        include: {
          invitedBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      return invitations;
    }),
});

async function getUserIdByEmail(ctx: Context, email: string): Promise<string> {
  const user = await ctx.db.user.findUnique({
    where: { email },
    select: { id: true },
  });
  return user?.id ?? "";
}
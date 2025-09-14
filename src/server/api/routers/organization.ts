import { z } from "zod";
import { TRPCError } from "@trpc/server";

import {
  createTRPCRouter,
  protectedProcedure,
} from "~/server/api/trpc";
import { Role } from "@prisma/client";
import { requireOrgMembership, requireOrgAdmin } from "~/server/api/utils/auth";

export const organizationRouter = createTRPCRouter({
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const organization = await ctx.db.organization.create({
        data: {
          name: input.name,
          createdBy: { connect: { id: ctx.session.user.id } },
          memberships: {
            create: {
              user: { connect: { id: ctx.session.user.id } },
              role: Role.ADMIN,
            },
          },
        },
        include: {
          memberships: {
            include: {
              user: true,
            },
          },
        },
      });

      return organization;
    }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const organizations = await ctx.db.organization.findMany({
      where: {
        memberships: {
          some: {
            userId: ctx.session.user.id,
          },
        },
      },
      include: {
        memberships: {
          where: {
            userId: ctx.session.user.id,
          },
          select: {
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return organizations.map((org) => ({
      ...org,
      userRole: org.memberships[0]?.role ?? Role.MEMBER,
    }));
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const { role } = await requireOrgMembership(ctx, input.id);

      const organization = await ctx.db.organization.findUnique({
        where: { id: input.id },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          memberships: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { joinedAt: "asc" },
          },
        },
      });

      if (!organization) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Organization not found",
        });
      }

      return {
        ...organization,
        userRole: role,
      };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx, input.id);

      const organization = await ctx.db.organization.update({
        where: { id: input.id },
        data: { name: input.name },
      });

      return {
        ...organization,
        userRole: Role.ADMIN,
      };
    }),
});
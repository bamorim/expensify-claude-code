# Task: Organization Management Foundation

## Meta Information

- **Task ID**: `TASK-001`
- **Title**: Organization Management Foundation
- **Status**: `Not Started`
- **Priority**: `P0`
- **Created**: 2025-09-14
- **Updated**: 2025-09-14
- **Estimated Effort**: 1 day

## Related Documents

- **PRD**: docs/product/prd-main.md (FR1, FR2)

## Description

Build upon the existing T3 Stack foundation to implement core organization management functionality. Replace the placeholder "post" model/router/components with organization creation and management, including proper multi-tenant authorization patterns.

## Acceptance Criteria

- [ ] Database schema extended with Organization and Membership models
- [ ] Organization tRPC router implemented with CRUD operations
- [ ] UI pages/components for listing and creating organizations
- [ ] Basic authorization utilities for org membership and admin checks
- [ ] Organization update functionality with admin-only access
- [ ] All tests passing and code quality checks (pnpm run check) passing
- [ ] Post-related code can be safely removed as reference implementation

## TODOs

- [ ] Extend Prisma schema with Organization and Membership models
  - Organization: id, name, createdAt, updatedAt, createdById
  - Membership: userId, organizationId, role (ADMIN/MEMBER), joinedAt
  - Add proper relationships and indexes
- [ ] Create and run database migration
- [ ] Create organization tRPC router (~/server/api/routers/organization.ts)
  - create: Create new organization (user becomes admin)
  - list: List user's organizations with role info
  - getById: Get organization details (members only)
  - update: Update organization (admins only)
- [ ] Add organization router to app router
- [ ] Create authorization utilities for reuse
  - requireOrgMembership(userId, orgId)
  - requireOrgAdmin(userId, orgId)
- [ ] Build organization UI components
  - OrganizationList: List user's organizations
  - CreateOrganization: Form to create new organization
  - UpdateOrganization: Form to update organization (admins only)
- [ ] Create organization pages
  - /organizations: List user's organizations
  - /organizations/new: Create new organization
  - /organizations/[id]: Organization details/settings
- [ ] Write comprehensive tests for router and authorization
- [ ] Set up environment variables (.env from .env.example)
- [ ] Ensure pnpm run check passes
- [ ] Remove post router, components, and references

## Progress Updates

### 2025-09-14 - Initial Planning

**Status**: Not Started
**Progress**: Analyzed existing codebase - T3 Stack already set up with NextAuth, Prisma, tRPC. Post model/router/components exist as reference implementation.
**Blockers**: Need .env setup for code quality checks
**Next Steps**: Extend database schema with Organization/Membership models

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Code follows project standards
- [ ] Tests written and passing
- [ ] pnpm run check passes
- [ ] Code review completed

## Notes

Current state analysis:

- ✅ T3 Stack foundation already set up (Next.js, TypeScript, Prisma, NextAuth, tRPC, Tailwind)
- ✅ Basic authentication with NextAuth working
- ✅ User model and authentication tables exist
- ✅ Post model/router/components exist as reference implementation
- ✅ Missing .env file (need to copy from .env.example)
- ❌ Missing Organization/Membership models
- ❌ No multi-tenant authorization patterns

The post model/router/components serve as a good reference for the patterns we need to implement for organizations.


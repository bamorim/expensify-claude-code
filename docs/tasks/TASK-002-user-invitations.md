# Task: User Invitations System (Console-Based)

## Meta Information

- **Task ID**: `TASK-002`
- **Title**: User Invitations System (Console-Based)
- **Status**: `Not Started`
- **Priority**: `P0`
- **Created**: 2025-09-14
- **Updated**: 2025-09-14
- **Estimated Effort**: 1 day

## Related Documents

- **PRD**: docs/product/prd-main.md (FR1)
- **Dependencies**: TASK-001

## Description

Implement simplified user invitation system where admins can invite users by email address. Instead of sending real emails, invitation links are logged to console, and logged-in users can see pending invitations for their email address.

## Acceptance Criteria

- [ ] Admins can create invitations by entering email addresses
- [ ] Invitation links logged to console for development
- [ ] Logged-in users can view pending invitations for their email
- [ ] Users can accept invitations and join organizations
- [ ] Invitation management UI for admins (pending/accepted status)
- [ ] Proper authorization (only admins can invite to their orgs)

## TODOs

- [ ] Create Invitation model in Prisma schema
  - id, email, organizationId, invitedById, role, status, token, createdAt, expiresAt
- [ ] Create invitation tRPC procedures
  - create: Create invitation (admins only)
  - listPendingForUser: Get pending invitations for current user's email
  - accept: Accept invitation and create membership
  - listForOrg: List organization's invitations (admins only)
- [ ] Build invitation UI components
  - InviteUser: Form for admins to invite by email
  - PendingInvitations: List for users to see their pending invites
  - OrganizationInvitations: Admin view of org's invitations
- [ ] Add invitation acceptance flow
- [ ] Console logging for invitation links
- [ ] Write tests for invitation system

## Notes

This simplified approach avoids email configuration complexity while maintaining full invitation functionality for development and testing.
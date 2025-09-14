# Task: Main Dashboard and Navigation

## Meta Information

- **Task ID**: `TASK-007`
- **Title**: Main Dashboard and Navigation
- **Status**: `Not Started`
- **Priority**: `P1`
- **Created**: 2025-09-14
- **Updated**: 2025-09-14
- **Estimated Effort**: 1 day

## Related Documents

- **PRD**: docs/product/prd-main.md
- **Dependencies**: TASK-001, TASK-002, TASK-005, TASK-006

## Description

Create main application dashboard and navigation system that provides overview of user's expenses, organizations, and pending actions. Replace the T3 landing page with proper application interface.

## Acceptance Criteria

- [ ] Main dashboard showing user's expense summary
- [ ] Navigation between organizations, expenses, and admin areas
- [ ] Role-based navigation (different views for admins vs members)
- [ ] Organization switching functionality
- [ ] Quick actions (submit expense, view pending approvals)
- [ ] Responsive design following existing Tailwind patterns

## TODOs

- [ ] Design main dashboard layout
- [ ] Create navigation components
  - MainNav: Top navigation with org switcher
  - SideNav: Section navigation based on role
- [ ] Build dashboard widgets
  - Recent expenses summary
  - Pending approvals (for admins)
  - Pending invitations
  - Quick actions
- [ ] Implement organization context/switching
- [ ] Update main page.tsx to use new dashboard
- [ ] Add breadcrumb navigation
- [ ] Ensure responsive design
- [ ] Write tests for navigation components

## Notes

This task unifies the user experience and provides central access to all application features based on user role and organization membership.
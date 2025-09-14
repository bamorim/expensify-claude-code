# Task: Expense Categories Management

## Meta Information

- **Task ID**: `TASK-003`
- **Title**: Expense Categories Management
- **Status**: `Not Started`
- **Priority**: `P0`
- **Created**: 2025-09-14
- **Updated**: 2025-09-14
- **Estimated Effort**: 0.5 days

## Related Documents

- **PRD**: docs/product/prd-main.md (FR3)
- **Dependencies**: TASK-001

## Description

Implement expense categories that admins can create, edit, and delete. Categories are organization-scoped and have name and optional description.

## Acceptance Criteria

- [ ] ExpenseCategory model with name, description, organizationId
- [ ] CRUD operations for categories (admin-only)
- [ ] Categories are organization-scoped
- [ ] UI for managing categories
- [ ] Proper authorization (only org admins can manage categories)

## TODOs

- [ ] Create ExpenseCategory model in Prisma schema
- [ ] Create category tRPC procedures
  - create, update, delete (admin-only)
  - list (members can view)
- [ ] Build category management UI
- [ ] Add to organization settings/admin panel
- [ ] Write tests for category operations

## Notes

Simple CRUD functionality. Categories will be used by policies and expenses in later tasks.


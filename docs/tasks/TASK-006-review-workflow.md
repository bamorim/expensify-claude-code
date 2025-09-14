# Task: Expense Review Workflow

## Meta Information

- **Task ID**: `TASK-006`
- **Title**: Expense Review Workflow
- **Status**: `Not Started`
- **Priority**: `P0`
- **Created**: 2025-09-14
- **Updated**: 2025-09-14
- **Estimated Effort**: 1 day

## Related Documents

- **PRD**: docs/product/prd-main.md (FR7)
- **Dependencies**: TASK-001, TASK-005

## Description

Implement review workflow where designated reviewers (admins) can approve or reject expenses that require manual review, with comments and status tracking.

## Acceptance Criteria

- [ ] Reviewers can view assigned expenses requiring review
- [ ] Approve/reject functionality with optional comments
- [ ] Status tracking through review process
- [ ] Review assignment logic (currently admins only)
- [ ] Audit trail for all review decisions
- [ ] Review dashboard for admins
- [ ] Notifications for users on review decisions

## TODOs

- [ ] Add review fields to Expense model
  - reviewedAt, reviewedById, reviewComments
- [ ] Create review tRPC procedures
  - listPendingReview: Expenses needing review (admins only)
  - approve: Approve expense with optional comments
  - reject: Reject expense with required comments
- [ ] Build review UI components
  - PendingReviewList: List of expenses needing review
  - ReviewExpense: Detailed review interface
  - ReviewHistory: Audit trail view
- [ ] Create admin review dashboard
- [ ] Implement review authorization (admins only)
- [ ] Add user notifications for review decisions
- [ ] Write tests for review workflow

## Notes

For now, all organization admins can review expenses. Future versions could add dedicated reviewer roles or assignment logic.
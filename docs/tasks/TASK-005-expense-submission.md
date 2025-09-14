# Task: Expense Submission System

## Meta Information

- **Task ID**: `TASK-005`
- **Title**: Expense Submission System
- **Status**: `Not Started`
- **Priority**: `P0`
- **Created**: 2025-09-14
- **Updated**: 2025-09-14
- **Estimated Effort**: 1.5 days

## Related Documents

- **PRD**: docs/product/prd-main.md (FR6)
- **Dependencies**: TASK-001, TASK-003, TASK-004

## Description

Implement expense submission functionality where users can submit expenses with automatic policy application, validation, and routing to appropriate approval workflow.

## Acceptance Criteria

- [ ] Expense model with date, amount, category, description
- [ ] Automatic policy rule application on submission
- [ ] Auto-rejection for expenses over policy limits
- [ ] Routing to auto-approval or manual review based on policy
- [ ] Expense status tracking (submitted, approved, rejected)
- [ ] User dashboard for submitted expenses
- [ ] Expense submission form with validation

## TODOs

- [ ] Create Expense model in Prisma schema
  - userId, organizationId, categoryId, amount, date, description, status, policyId, reviewerId
- [ ] Implement expense submission logic
  - Apply policy rules automatically
  - Determine approval workflow
  - Create audit trail
- [ ] Create expense tRPC procedures
  - submit: Create new expense with policy application
  - list: User's expenses with filtering/pagination
  - getById: Expense details
- [ ] Build expense submission UI
  - Expense form with category selection
  - Amount validation against policies
  - Policy feedback to user
- [ ] Create user expense dashboard
- [ ] Write tests for expense submission and policy application

## Notes

This connects the policy system with actual expense processing. Policy application logic must be consistent and auditable.
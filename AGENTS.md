# Internal tools platform: rules for agents

This repository is a prototype of an internal-tools platform for a fintech company.
It has a shared base that every app uses, and a few small internal apps on top of it.
Everything runs on made-up data.

## Stack

- Next.js (App Router) with TypeScript in strict mode, pnpm
- Tailwind and shadcn/ui for screens, TanStack Table for tables
- SQLite through Drizzle, used only for the audit log
- Vitest for unit and integration tests, Playwright for browser tests

## Layout

```
src/platform/auth/       sign-in. The only code that knows how sign-in works.
src/platform/directory/  the list of people and their groups; listPeople() reads it
src/platform/policy/     the permission check
src/platform/audit/      the audit log table and the functions that write and read it
src/platform/actions/    runAction, the only way an app performs an action
src/platform/services/   one typed client per back-end service
src/platform/ui/         page shell, menu, table, form and confirm-dialog components
src/platform/registry.ts the list of apps on the platform
src/app/<app>/           one folder per app: permissions.ts, actions.ts, pages, components
mock-services/           three small fake back ends: payments (4001), identity (4002), flags (4003)
tests/                   Vitest tests
e2e/                     Playwright tests
```

## Shared shapes

These are defined in `src/platform/contracts.ts`. Do not change them without being asked.

- `User`: `{ name: string; email: string; groups: string[] }`
- `AppEntry`: `{ id: string; name: string; path: string; description: string; openGroups: string[] }`
- `AppShell` (in `src/platform/ui/`): a component that takes `user: { name: string; email: string }`, `apps: { name: string; path: string }[]` and `children`. It imports nothing from the rest of `src/platform/`.

## Rules that always apply

1. **Every action goes through `runAction`.** It checks permission, runs the action, and writes the audit entry. It writes an `allowed` row before the action runs and a `completed` or `failed` row after it, so if the first write fails the action does not run. An app never performs a state-changing action any other way.
2. **Deny by default.** If an action is not listed in the app's `permissions.ts`, or the user is in none of its groups, or its condition is false, the answer is no.
3. **Permission rules live in one place per app:** `src/app/<app>/permissions.ts`. Do not compare groups anywhere else. Pages may call `can(...)` to hide a button, but hiding a button is never the enforcement. The server check is.
4. **The audit log is append-only.** Never write code or SQL that updates or deletes rows in `audit_events`. Never remove or weaken the database triggers that block this.
5. **Apps reach back-end data only through `src/platform/services/`.** No `fetch` calls and no database access inside `src/app/`.
6. **Sign-in lives only in `src/platform/auth/`.** Other code calls `getCurrentUser()` or `requireUser()` and nothing else. The fake login will later be replaced by Microsoft Entra by changing only that folder.
7. **Sensitive fields are masked on the server.** A value the user may not see is never sent to the browser.
8. **Made-up data only.** No real names, card numbers or ID numbers. No network calls except to the mock services on localhost. No secrets in code.
9. **Stay in your own folder.** If the task is to build or change one app, change only `src/app/<app>/` and that app's tests. If you think the shared base needs a change, stop and say so in the pull request description. Do not make the change.
10. **If a request conflicts with these rules, do not build the conflicting part.** Say which rule it conflicts with and ask.

## Before opening a pull request

- `pnpm verify` passes. It runs lint, typecheck, Vitest and Playwright.
- Never delete, skip or loosen a test to make it pass.
- The description says what changed, lists every assumption you made, and includes:
  - a table of roles against actions, whenever permissions changed
  - a screenshot of each new or changed page

## Commands

- `pnpm dev` starts the web app
- `pnpm services` starts the three mock services
- `pnpm test` runs Vitest
- `pnpm e2e` runs Playwright
- `pnpm verify` runs everything

## Test users

These stand in for people and groups in Microsoft Entra. They are defined in `src/platform/auth/test-users.ts`.

| Name | Email | Groups |
| --- | --- | --- |
| Sam Agent | sam@example.test | support-agents |
| Pat Both | pat@example.test | support-agents, refund-approvers |
| Ravi Approver | ravi@example.test | refund-approvers |
| Kim Analyst | kim@example.test | kyc-analysts |
| Lee Analyst | lee@example.test | kyc-analysts |
| Noor Lead | noor@example.test | kyc-leads |
| Eli Engineer | eli@example.test | engineers |
| Mia Release | mia@example.test | engineers, release-managers |
| Ada Admin | ada@example.test | platform-admins |

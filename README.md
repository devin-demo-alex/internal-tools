# internal-tools

## What this is

A prototype internal-tools platform: a shared base, three small apps on top of it (refunds, a KYC review queue, a feature-flag panel) and an admin centre. All data is made up.

It stands in for replacing a low-code internal-tools product with code: the shared base supplies sign-in, permissions and the audit log once, so each new app is a small folder of pages and rules.

## Hosted demo

https://internal-tools--kichcmtv.preview.devinapps.com/

This is a Devin App. Opening it requires signing in to Devin. It runs with the demo data switched on, and its data resets when it restarts.

## What is in it

Shared base, in `src/platform/`:

- `auth/`: sign-in. A fake login page with one button per test user, and a signed session cookie.
- `policy/`: the permission check. Deny by default.
- `audit/`: the audit log, an append-only SQLite table.
- `actions/`: `runAction`, the only way an app performs an action.
- `ui/`: screen parts: page frame, menu, table, form, confirm dialog.
- `registry.ts`: the list of apps and the groups that may open each one.
- `services/`: one typed client per back-end service.

Fake back-end services, in `mock-services/` (data held in memory):

- payments, port 4001: payments and refunds.
- identity, port 4002: KYC cases.
- flags, port 4003: feature flags for staging and production.

Apps, in `src/app/`:

- `refunds/`: support agents request refunds; approvers approve or reject them.
- `kyc/`: analysts and leads claim, approve, reject or escalate identity-check cases.
- `flags/`: engineers switch staging flags; release managers switch production flags.
- `admin/`: the admin centre. Read-only pages for apps, roles, people and the audit log.

## How a request flows

Ravi approves a refund:

1. The refund page shows an Approve button because `can(...)` says Ravi may use it. Ravi clicks it and confirms.
2. The server action in `src/app/refunds/actions.ts` loads the refund and calls `runAction`.
3. `runAction` asks the permission check. The rule in `src/app/refunds/permissions.ts` requires the `refund-approvers` group, a refund still in `requested` status, and a requester who is not Ravi.
4. If the answer is no, `runAction` writes one `denied` audit row and the user gets a 403 page. Nothing else runs.
5. If the answer is yes, `runAction` writes an `allowed` audit row, then calls the payments client in `src/platform/services/payments.ts`.
6. The client calls the fake payments service on port 4001, which checks its own rules and changes the refund.
7. `runAction` writes a `completed` row with the before and after values, or a `failed` row if the service refused.

```
page (src/app/refunds)
  -> server action (actions.ts)
    -> runAction ----> permission check (permissions.ts)
       |          \--> audit log (SQLite): allowed/denied, then completed/failed
       v
     service client (src/platform/services)
       -> fake service (mock-services, localhost:4001)
```

## How to run it

You need Node.js and pnpm. These commands were run from a fresh clone with Node 24.22.2 and pnpm 12.16.1.

```sh
pnpm install
pnpm --dir mock-services install   # the fake services have their own install
```

In one terminal, start the fake services:

```sh
pnpm services
```

In a second terminal, start the web app with the demo data switched on:

```sh
DEMO_SEED=true pnpm dev
```

Open http://localhost:3000 and pick a test user.

`DEMO_SEED=true` fills the audit log with made-up history at start-up, but only if the audit log is empty. Plain `pnpm dev` starts without it. `pnpm seed:demo` does the same fill by hand.

The audit log is kept in `.data/audit.db` and survives restarts. The fake services go back to their starting data when restarted.

## Who to sign in as

| Name | Email | Groups | Can do |
| --- | --- | --- | --- |
| Sam Agent | sam@example.test | support-agents | Refunds: view, request |
| Pat Both | pat@example.test | support-agents, refund-approvers | Refunds: view, request, approve or reject requests made by others |
| Ravi Approver | ravi@example.test | refund-approvers | Refunds: view, approve, reject |
| Kim Analyst | kim@example.test | kyc-analysts | KYC: claim open unassigned cases; on her own open cases, approve if the risk score is under 80, reject, escalate, see the full ID number |
| Lee Analyst | lee@example.test | kyc-analysts | Same as Kim, for his own cases |
| Noor Lead | noor@example.test | kyc-leads | KYC: claim, approve or reject any open case; see every full ID number |
| Eli Engineer | eli@example.test | engineers | Flags: view all, switch staging flags |
| Mia Release | mia@example.test | engineers, release-managers | Flags: view all, switch staging and production flags |
| Ada Admin | ada@example.test | platform-admins | Admin centre only |

Each user sees only their own apps on the home page. Opening another app's address gives a 403 page.

## Things to try

Sign out with the link in the page frame to switch users.

1. **Request and approve.** As Sam, open Refunds, choose "New refund request" and send one. As Ravi, open it, then Approve and Confirm. The status becomes `approved`.
2. **No self-approval.** As Pat, open `/refunds/ref_002`, which Pat requested: there are no Approve or Reject buttons. Open `/refunds/ref_001`, which Sam requested: both are there.
3. **High-risk case.** As Kim, open `/kyc/case_002` (risk score 86, assigned to Kim): she gets Reject and Escalate but no Approve. On `/kyc/case_003` (risk score 45) she gets all three.
4. **Masked ID number.** As Lee, open `/kyc/case_003`, which is Kim's: the ID number shows as `••••0003` and there are no action buttons. Kim and Noor see `FAKE-N-00003`.
5. **Production flags.** As Eli, open Feature flags: only staging rows have a button. As Mia, every row has one.
6. **Audit log.** As Ada, open Admin, then Audit log. Each action above appears as an `allowed` row and a `completed` row. Set Outcome to `denied` to see refusals. Click a row for the before and after values.

## How to run the tests

```sh
pnpm test     # Vitest
pnpm e2e      # Playwright
pnpm verify   # lint, typecheck, Vitest, then Playwright
```

- **Vitest** (`tests/`) covers the shared base (permission check, `runAction`, audit log, session, registry, directory, demo data) and each app's permission rules and actions: who is allowed, who is refused, and which audit rows are written.
- **Playwright** (`e2e/`) drives a real browser through sign-in, each app's working paths and refusals, the 403 and 404 pages, and the admin centre. It starts the fake services and the web app itself, or reuses them if they are already running.

## How to add a new app

The recipe is [.agents/skills/new-internal-app/SKILL.md](.agents/skills/new-internal-app/SKILL.md). A coding agent follows it, using the refunds app as the reference. A person writes a description that gives the folder name, the service client, the screens, the actions with their groups and conditions, and any masked fields. For example:

```
Build the app in src/app/flags using the flags service client.
List page: key, description, environment, on or off, last changed by, last changed at.
No detail page.
Actions: view (engineers, release-managers);
toggle (engineers on staging flags, release-managers on production flags).
No masked fields.
```

The app's folder name must already be listed in `src/platform/registry.ts`.

## The rules the code follows

The full list is in [AGENTS.md](AGENTS.md). In short:

- Every action goes through `runAction`, which checks permission and writes the audit rows.
- Deny by default: no listed rule, wrong group or false condition means no.
- Each app's rules live only in its `permissions.ts`. Hiding a button is not the enforcement; the server check is.
- The audit log is append-only. Database triggers block updates and deletes.
- Apps reach back-end data only through `src/platform/services/`.
- Sign-in lives only in `src/platform/auth/`.
- Sensitive fields are masked on the server.
- Made-up data only, no secrets, no network calls except to the fake services.
- Work on one app stays in that app's folder and tests.

## What is faked, and what a real version would need

This is a prototype. It is not ready for real data or real users.

| Part | Here | A real version needs |
| --- | --- | --- |
| Sign-in | A page of buttons, one per test user. No passwords. | A real identity provider. `AGENTS.md` names Microsoft Entra, replacing only `src/platform/auth/`. |
| Back-end services | Three small local services with made-up data held in memory. | Clients for the real systems behind the same `src/platform/services/` files. |
| Trust between app and service | None. The services accept any caller and believe the email address the app sends. | Authenticated calls from app to service, and services that verify who is acting. |
| Audit log storage | A SQLite file on local disk. | Durable storage that the app cannot alter, with backups and retention. |
| Hosting | The development server (`pnpm dev`) on one machine. | A production build and deployment, with secrets and monitoring. |
| Security testing | The automated tests in this repository only. | A security review and penetration test. |

## Known limitations

- **Escalated KYC cases are a dead end.** Decisions are allowed only on open cases, and the fake identity service refuses a second decision, so nobody can approve or reject an escalated case.
- **KYC leads cannot escalate.** Only analysts can.
- **Ordinary KYC views are not audited.** Only views that reveal a full ID number write audit rows.
- **The audit page does not scale.** It reads at most 5000 rows and filters dates in application code.
- **The audit triggers block row changes only.** Someone with direct access to the database file could still drop the triggers or the table.
- **The admin centre is read-only.** Apps, roles and people are changed in code.

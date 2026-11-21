# internal-tools

## What this is

A prototype internal-tools platform: a shared base, three small apps on top of it (refunds, a KYC review queue, a feature-flag panel) and an admin centre. All data is made up.

It stands in for replacing a low-code internal-tools product with code: the shared base supplies sign-in, permissions and the audit log once, so each new app is a small folder of pages and rules.

## Hosted demo

https://internal-tools--kichcmtv.preview.devinapps.com/

This is a Devin App. Opening it requires signing in to Devin. It runs with the demo data switched on, and its data resets when it restarts.

## What is in it

- **Shared base** (`src/platform/`): sign-in, permission check, audit log, the action runner `runAction`, screen parts, the app list, and one typed client per back-end service.
- **Fake back-end services** (`mock-services/`): payments (port 4001), identity (4002) and flags (4003), with data held in memory.
- **Apps** (`src/app/`): `refunds`, `kyc` and `flags`.
- **Admin centre** (`src/app/admin/`): read-only pages for apps, roles, people and the audit log.

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

`DEMO_SEED=true` fills the audit log with made-up history at start-up, but only if the audit log is empty. Plain `pnpm dev` starts without it.

## Who to sign in as

| Name | Email | Can do |
| --- | --- | --- |
| Sam Agent | sam@example.test | Refunds: view, request |
| Pat Both | pat@example.test | Refunds: view, request, approve or reject requests made by others |
| Ravi Approver | ravi@example.test | Refunds: view, approve, reject |
| Kim Analyst | kim@example.test | KYC: claim open unassigned cases; on her own open cases, approve if the risk score is under 80, reject, escalate, see the full ID number |
| Lee Analyst | lee@example.test | Same as Kim, for his own cases |
| Noor Lead | noor@example.test | KYC: claim, approve or reject any open case; see every full ID number |
| Eli Engineer | eli@example.test | Flags: view all, switch staging flags |
| Mia Release | mia@example.test | Flags: view all, switch staging and production flags |
| Ada Admin | ada@example.test | Admin centre only |

Each user sees only their own apps. Opening another app's address gives a 403 page.

## How to run the tests

```sh
pnpm test     # Vitest: the shared base, and each app's permission rules, actions and audit rows
pnpm e2e      # Playwright: sign-in, each app's working paths and refusals, the admin centre
pnpm verify   # lint, typecheck, Vitest, then Playwright
```

## More

- To add a new app, follow the recipe in [.agents/skills/new-internal-app/SKILL.md](.agents/skills/new-internal-app/SKILL.md).
- The rules the code follows are in [AGENTS.md](AGENTS.md).
- This is a prototype. Sign-in and the back-end services are fake, and it is not ready for real data or real users.

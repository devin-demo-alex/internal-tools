name: new-internal-app description: Build a new internal app on the shared base by copying the refunds app. Use when asked to add an internal app or tool to this repository.
New internal app
Overview
Build one new internal app on the shared base in this repository, by following the refunds app as the reference. The result is one pull request that changes only the new app's folder and its tests.
What's Needed From User
- The app's folder name. It must already be listed in `src/platform/registry.ts`.
- Which back-end service client it uses (a file in `src/platform/services/`).
- The screens: the columns on the list page and the fields on the detail page.
- The actions: for each one, which groups may do it and under what condition.
- Any fields that must be masked, and who may see them unmasked.
If any of these is missing or unclear, ask before writing code.
Procedure
Read `AGENTS.md` and every file in `src/app/refunds/`. Refunds is the reference app.
Read the service client the user named in `src/platform/services/`. Do not change it.
Write `src/app/<app>/permissions.ts` with one entry per action in the user's spec.
  - Put each condition in that entry's `when` function, the way refunds does for "cannot approve your own request".
Write `src/app/<app>/actions.ts` with one server action per action in the spec.
  - Each one calls `runAction`, the same way the refunds actions do.
  - Whatever you pass to `runAction` as the resource, and whatever the action returns as before and after, is stored in the audit log. Pass only the fields the permission check needs, return only the fields that changed, and never include a field that must be masked.
Build the list page with the shared table component and the columns from the spec.
Build the detail page, if the spec has one, with the shared layout components.
If the app has a detail page, write `src/app/<app>/page-exists.ts` the way refunds does, so that a record that does not exist returns a real 404 status.
  - Register it in `src/platform/registry.ts` with exactly one registration line beside the app's permissions, `pageExists: <app>PageExists,`, and the import that line needs, the way refunds does.
  - This is the only edit a new app may make under `src/platform/`. Name it in the pull request description.
Add a button for each action, using the shared confirm dialog.
  - Use `can(...)` to hide a button the user may not use. The server check in `runAction` is still the enforcement.
Mask any sensitive field on the server before the data reaches the page.
Write Vitest tests in `tests/<app>/`:
  - for every action, each allowed group succeeds and every other test user is refused
  - every condition is tested both ways
  - every successful action writes exactly one `allowed` audit entry and one `completed` audit entry
  - every refused action writes exactly one `denied` audit entry and changes nothing
  - every masked field is absent from what the server sends to a user who may not see it
Write Playwright tests in `e2e/<app>.spec.ts`: one working path per group, and one refusal.
Run `pnpm verify` and fix failures until it passes.
Open one pull request titled `Add <app> app`.
Specifications
- Only `src/app/<app>/`, `tests/<app>/` and `e2e/<app>.spec.ts` have changed, plus the one `pageExists` registration line in `src/platform/registry.ts` if the app has a detail page.
- `pnpm verify` passes.
- Every action in the spec is in `permissions.ts`, and nothing else is.
- A user without permission gets a 403 from the server for every action, even when calling it directly.
- The pull request description contains:
  - a table of groups against actions, with conditions noted
  - a screenshot of each page
  - a list of every assumption you made and anything in the spec that was unclear
Advice and Pointers
- Copy the structure and file names of the refunds app. Do not invent a new pattern.
- Keep the code plain. No new abstractions, no new shared helpers.
- The mock services reset their data through their reset endpoint. Use it at the start of each test, as the refunds tests do.
- If the service refuses a request, show its error message on the page. Do not hide it.
Forbidden Actions
- Do not change anything in `src/platform/`, `mock-services/`, another app's folder, or root configuration files. The one exception is the `pageExists` registration line in `src/platform/registry.ts` described in the procedure.
- Do not add dependencies.
- Do not call `fetch` or the database from the app's folder.
- Do not compare groups anywhere except through `permissions.ts`.
- Do not delete, skip or loosen a test.
- Do not build anything that conflicts with a rule in `AGENTS.md`, even if the spec asks for it. Say so in the pull request instead.

import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { buildRolesGrid } from "@/app/admin/roles/grid";
import { CONDITION_NOTE, NO_ACTIONS, RolesGridTable } from "@/app/admin/roles/roles-grid";
import type { Permissions } from "@/platform/policy";

const permissions: Permissions = {
  "refund.request": { groups: ["support-agents"] },
  "refund.approve": {
    groups: ["refund-approvers"],
    when: (user, refund: { requestedBy: string }) => refund.requestedBy !== user.email,
  },
  "refund.export": { groups: ["support-agents", "refund-approvers", "auditors"] },
};

/** The rendered grid as rows of cell text, header row first. */
function renderedCells(html: string): string[][] {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(([, row]) =>
    [...row.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map(([, cell]) =>
      cell.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    ),
  );
}

test("the grid has one row per action and one column per group", () => {
  expect(buildRolesGrid(permissions, ["support-agents", "refund-approvers"])).toEqual({
    groups: ["support-agents", "refund-approvers", "auditors"],
    rows: [
      {
        action: "refund.request",
        hasCondition: false,
        allowed: { "support-agents": true, "refund-approvers": false, auditors: false },
      },
      {
        action: "refund.approve",
        hasCondition: true,
        allowed: { "support-agents": false, "refund-approvers": true, auditors: false },
      },
      {
        action: "refund.export",
        hasCondition: false,
        allowed: { "support-agents": true, "refund-approvers": true, auditors: true },
      },
    ],
  });
});

test("the rendered grid matches the permissions object and marks the condition", () => {
  const html = renderToStaticMarkup(
    <RolesGridTable grid={buildRolesGrid(permissions, ["support-agents", "refund-approvers"])} />,
  );

  expect(renderedCells(html)).toEqual([
    ["Action", "support-agents", "refund-approvers", "auditors"],
    ["refund.request", "Allowed", "No", "No"],
    ["refund.approve Conditional", "No", "Allowed", "No"],
    ["refund.export", "Allowed", "Allowed", "Allowed"],
  ]);
  expect(html).toContain(CONDITION_NOTE);
  expect(CONDITION_NOTE).toContain("a condition applies");
});

test("no condition note is shown when no action has a condition", () => {
  const html = renderToStaticMarkup(
    <RolesGridTable grid={buildRolesGrid({ "flag.toggle": { groups: ["engineers"] } })} />,
  );
  expect(renderedCells(html)).toEqual([
    ["Action", "engineers"],
    ["flag.toggle", "Allowed"],
  ]);
  expect(html).not.toContain(CONDITION_NOTE);
});

test.each([[{}], [undefined]])("empty permissions (%j) show 'No actions yet'", (empty) => {
  const grid = buildRolesGrid(empty, ["support-agents"]);
  expect(grid.rows).toEqual([]);
  const html = renderToStaticMarkup(<RolesGridTable grid={grid} />);
  expect(html).toContain(NO_ACTIONS);
  expect(NO_ACTIONS).toBe("No actions yet");
  expect(html).not.toContain("<table");
});

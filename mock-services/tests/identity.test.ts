import { describe, expect, test } from "vitest";
import { claimCase, decideCase, getCase, listCases } from "../../src/platform/services/identity";
import { buildIdentityService } from "../src/identity";
import { expectRefusal, startService } from "./helpers";

startService(buildIdentityService, "IDENTITY_SERVICE_URL");

describe("cases", () => {
  test("GET /cases lists the seeded cases, several of them high risk", async () => {
    const cases = await listCases();
    expect(cases).toHaveLength(15);
    expect(cases.every((c) => c.riskScore >= 0 && c.riskScore <= 100)).toBe(true);
    expect(cases.filter((c) => c.riskScore >= 80).length).toBeGreaterThanOrEqual(5);
    expect(new Set(cases.map((c) => c.status))).toEqual(new Set(["open", "approved", "rejected", "escalated"]));
  });

  test("GET /cases filters by status", async () => {
    expect(await listCases({ status: "open" })).toHaveLength(10);
    expect((await listCases({ status: "approved" })).map((c) => c.id)).toEqual(["case_010", "case_013"]);
    expect((await listCases({ status: "rejected" })).map((c) => c.id)).toEqual(["case_011"]);
    expect((await listCases({ status: "escalated" })).map((c) => c.id)).toEqual(["case_012", "case_014"]);
  });

  test("GET /cases refuses an unknown status", async () => {
    await expectRefusal(listCases({ status: "closed" as never }), 400, /^status must be one of/);
  });

  test("GET /cases/:id returns one case", async () => {
    expect(await getCase("case_011")).toEqual({
      id: "case_011",
      customerRef: "CUST-1011",
      customerName: "Wendell Harrowgate",
      dateOfBirth: "1972-10-19",
      documentType: "passport",
      idNumber: "FAKE-P-00011",
      riskScore: 88,
      status: "rejected",
      assignedTo: "lee@example.test",
      notes: ["Document failed the authenticity check"],
      decidedBy: "lee@example.test",
      decidedAt: "2026-01-21T14:40:00.000Z",
    });
  });

  test("GET /cases/:id refuses an unknown case", async () => {
    await expectRefusal(getCase("case_999"), 404, "Case case_999 not found");
  });

  test("POST /cases/:id/claim assigns an unassigned case", async () => {
    const claimed = await claimCase("case_001", { analyst: "kim@example.test" });
    expect(claimed).toMatchObject({ id: "case_001", assignedTo: "kim@example.test", status: "open" });
    expect(await getCase("case_001")).toEqual(claimed);
  });

  test("POST /cases/:id/claim refuses a case that is already assigned", async () => {
    await expectRefusal(
      claimCase("case_003", { analyst: "lee@example.test" }),
      409,
      "Case case_003 is already assigned to kim@example.test",
    );
    await expectRefusal(claimCase("case_003", { analyst: "kim@example.test" }), 409, /already assigned/);
    await claimCase("case_001", { analyst: "kim@example.test" });
    await expectRefusal(claimCase("case_001", { analyst: "lee@example.test" }), 409, /already assigned to kim@example.test/);
  });

  test("POST /cases/:id/claim refuses an unknown case and a missing analyst", async () => {
    await expectRefusal(claimCase("case_999", { analyst: "kim@example.test" }), 404, "Case case_999 not found");
    await expectRefusal(claimCase("case_001", { analyst: "" }), 400, "analyst is required");
  });

  test.each([
    ["approve", "approved"],
    ["reject", "rejected"],
    ["escalate", "escalated"],
  ] as const)("POST /cases/:id/decision with %s sets the status to %s", async (decision, status) => {
    const decided = await decideCase("case_002", { decision, by: "kim@example.test", note: "Checked by hand" });
    expect(decided).toMatchObject({ id: "case_002", status, decidedBy: "kim@example.test" });
    expect(decided.decidedAt).not.toBeNull();
    expect(decided.notes).toEqual(["Address does not match the document", "Checked by hand"]);
    expect(await getCase("case_002")).toEqual(decided);
  });

  test("POST /cases/:id/decision works without a note", async () => {
    const decided = await decideCase("case_001", { decision: "approve", by: "kim@example.test" });
    expect(decided).toMatchObject({ status: "approved", notes: [] });
  });

  test.each([
    ["approved", "case_010"],
    ["rejected", "case_011"],
    ["escalated", "case_012"],
  ])("POST /cases/:id/decision refuses a case that is already %s", async (status, id) => {
    await expectRefusal(
      decideCase(id, { decision: "approve", by: "noor@example.test", note: "Second look" }),
      409,
      `Case ${id} is already ${status}`,
    );
    expect((await getCase(id)).status).toBe(status);
  });

  test("POST /cases/:id/decision refuses an unknown case, an unknown decision and a missing by", async () => {
    await expectRefusal(decideCase("case_999", { decision: "approve", by: "kim@example.test" }), 404, "Case case_999 not found");
    await expectRefusal(
      decideCase("case_001", { decision: "defer" as never, by: "kim@example.test" }),
      400,
      "decision must be one of: approve, reject, escalate",
    );
    await expectRefusal(decideCase("case_001", { decision: "approve", by: "" }), 400, "by is required");
  });

  test("POST /__reset restores the seed data", async () => {
    await claimCase("case_001", { analyst: "kim@example.test" });
    await decideCase("case_001", { decision: "reject", by: "kim@example.test", note: "Forged" });

    const response = await fetch(`${process.env.IDENTITY_SERVICE_URL}/__reset`, { method: "POST" });
    expect(response.status).toBe(200);

    expect(await getCase("case_001")).toMatchObject({
      status: "open",
      assignedTo: null,
      notes: [],
      decidedBy: null,
      decidedAt: null,
    });
  });
});

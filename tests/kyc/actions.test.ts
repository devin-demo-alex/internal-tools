import { describe, expect, test } from "vitest";
import type { User } from "@/platform/contracts";
import { startIdentityService } from "./helpers";

process.env.AUDIT_DB_PATH = ":memory:";

const { ForbiddenError } = await import("@/platform/actions");
const { listAudit } = await import("@/platform/audit");
const { getCase, listCases } = await import("@/platform/services/identity");
const { approveKycCase, claimKycCase, escalateKycCase, rejectKycCase, viewCase, viewCases } =
  await import("@/app/kyc/actions");

startIdentityService();

const kim: User = { name: "Kim Analyst", email: "kim@example.test", groups: ["kyc-analysts"] };
const lee: User = { name: "Lee Analyst", email: "lee@example.test", groups: ["kyc-analysts"] };
const noor: User = { name: "Noor Lead", email: "noor@example.test", groups: ["kyc-leads"] };
const sam: User = { name: "Sam Agent", email: "sam@example.test", groups: ["support-agents"] };

// case_001: open, unassigned, risk 12, ID number FAKE-P-00001, born 1988-03-14.
// case_003: open, assigned to Kim, risk 45, ID number FAKE-N-00003.
// case_006: open, assigned to Lee, risk 81.
// case_010: approved, assigned to Kim, risk 22.

test("Kim claims a case, Lee is refused on it, and Kim approves it", async () => {
  expect(await claimKycCase(kim, "case_001")).toEqual({});
  const claimed = await getCase("case_001");
  expect(claimed).toMatchObject({ status: "open", assignedTo: "kim@example.test" });

  // Lee is an analyst, but the case is Kim's.
  await expect(claimKycCase(lee, "case_001")).rejects.toBeInstanceOf(ForbiddenError);
  await expect(approveKycCase(lee, "case_001")).rejects.toBeInstanceOf(ForbiddenError);
  await expect(rejectKycCase(lee, "case_001", "Not mine")).rejects.toBeInstanceOf(ForbiddenError);
  await expect(escalateKycCase(lee, "case_001", "Not mine")).rejects.toBeInstanceOf(ForbiddenError);
  expect(await getCase("case_001")).toEqual(claimed);
  const byLee = await listAudit({ actorEmail: "lee@example.test", resourceId: "case_001" });
  expect(byLee).toHaveLength(4);
  for (const entry of byLee) {
    expect(entry).toMatchObject({
      app: "kyc",
      resourceType: "kyc-case",
      outcome: "denied",
      before: null,
      after: null,
    });
  }

  expect(await approveKycCase(kim, "case_001")).toEqual({});
  expect(await getCase("case_001")).toMatchObject({ status: "approved", decidedBy: "kim@example.test" });

  const claim = await listAudit({ actorEmail: "kim@example.test", action: "kyc.claim" });
  expect(claim.map((entry) => entry.outcome)).toEqual(["completed", "allowed"]);
  // Only the fields the permission check needs, and only the field that changed.
  expect(claim[1].before).toEqual({ status: "open", assignedTo: null, riskScore: 12 });
  expect(claim[0].before).toEqual({ assignedTo: null });
  expect(claim[0].after).toEqual({ assignedTo: "kim@example.test" });

  const approve = await listAudit({ actorEmail: "kim@example.test", action: "kyc.approve" });
  expect(approve.map((entry) => entry.outcome)).toEqual(["completed", "allowed"]);
  expect(approve[1].before).toEqual({ status: "open", assignedTo: "kim@example.test", riskScore: 12 });
  expect(approve[0].before).toEqual({ status: "open" });
  expect(approve[0].after).toEqual({ status: "approved" });
});

test("Lee escalates a high-risk case Lee may not approve, with a note", async () => {
  await expect(approveKycCase(lee, "case_006")).rejects.toBeInstanceOf(ForbiddenError);

  expect(await escalateKycCase(lee, "case_006", "Two names on file")).toEqual({});

  const escalated = await getCase("case_006");
  expect(escalated).toMatchObject({ status: "escalated", decidedBy: "lee@example.test" });
  expect(escalated.notes).toContain("Two names on file");
  const [completed, allowed, ...rest] = await listAudit({
    actorEmail: "lee@example.test",
    action: "kyc.escalate",
    resourceId: "case_006",
  });
  expect(rest).toEqual([]);
  expect(allowed.outcome).toBe("allowed");
  // The note is free text, so it stays out of the audit log.
  expect(completed).toMatchObject({
    outcome: "completed",
    before: { status: "open" },
    after: { status: "escalated" },
  });
});

test("Noor rejects an open case that is assigned to somebody else", async () => {
  expect(await rejectKycCase(noor, "case_006", "Documents do not match")).toEqual({});

  expect(await getCase("case_006")).toMatchObject({
    status: "rejected",
    assignedTo: "lee@example.test",
    decidedBy: "noor@example.test",
  });
});

test("a case that is already decided shows the service's error", async () => {
  // Kim is assigned to case_010, so the permission check passes and the service refuses.
  const before = await getCase("case_010");

  expect(await approveKycCase(kim, "case_010")).toEqual({ error: "Case case_010 is already approved" });

  expect(await getCase("case_010")).toEqual(before);
  const [failed, allowed] = await listAudit({
    actorEmail: "kim@example.test",
    action: "kyc.approve",
    resourceId: "case_010",
  });
  expect(allowed.outcome).toBe("allowed");
  expect(failed).toMatchObject({ outcome: "failed", after: { error: "Case case_010 is already approved" } });
});

test("a case that does not exist shows the service's error and writes no audit entry", async () => {
  expect(await claimKycCase(kim, "case_999")).toEqual({ error: "Case case_999 not found" });
  expect(await listAudit({ resourceId: "case_999" })).toEqual([]);
});

describe("kyc.viewFullId", () => {
  const views = (user: User, caseId: string) =>
    listAudit({ actorEmail: user.email, action: "kyc.viewFullId", resourceId: caseId });

  test("Kim opening her own case sees the full ID number and leaves the audit rows", async () => {
    // case_003 is assigned to Kim.
    expect(await viewCase(kim, "case_003")).toMatchObject({ idNumber: "FAKE-N-00003", idNumberMasked: false });
    const rows = await views(kim, "case_003");
    expect(rows.map((row) => row.outcome).sort()).toEqual(["allowed", "completed"]);
    for (const row of rows) {
      expect(row).toMatchObject({ app: "kyc", resourceType: "kyc-case", after: null });
    }
    expect(rows.find((row) => row.outcome === "completed")).toMatchObject({ before: null, after: null });
    expect(JSON.stringify(rows)).not.toContain("FAKE-");
  });

  test("Lee opening Kim's case sees the masked ID number and leaves no audit row", async () => {
    const before = (await listAudit({ limit: 10_000 })).length;
    expect(await viewCase(lee, "case_003")).toMatchObject({ idNumber: "••••0003", idNumberMasked: true });
    expect(await views(lee, "case_003")).toEqual([]);
    expect(await listAudit({ limit: 10_000 })).toHaveLength(before);
  });

  test("a lead opening any case leaves the audit rows; the list leaves none", async () => {
    const before = (await listAudit({ limit: 10_000 })).length;
    await viewCases(noor);
    await viewCases(kim);
    expect(await listAudit({ limit: 10_000 })).toHaveLength(before);
    await viewCase(noor, "case_001");
    expect((await views(noor, "case_001")).map((row) => row.outcome).sort()).toEqual(["allowed", "completed"]);
  });
});

describe("masking", () => {
  test("a note quoting the full ID number is masked for an analyst the case is not assigned to", async () => {
    // case_003 is assigned to Kim.
    expect(
      await rejectKycCase(kim, "case_003", "ID number FAKE-N-00003 is not valid; fake-n-00003 again"),
    ).toEqual({});

    const forLee = await viewCase(lee, "case_003");
    expect(forLee.idNumberMasked).toBe(true);
    expect(JSON.stringify(forLee).toLowerCase()).not.toContain("fake-n-00003");
    expect(forLee.notes.at(-1)).toBe("ID number ••••0003 is not valid; ••••0003 again");

    // Kim, whose case it is, and a lead still read the note as written.
    for (const user of [kim, noor]) {
      expect((await viewCase(user, "case_003")).notes.at(-1)).toContain("FAKE-N-00003");
    }
  });

  test("the ID number is masked to its last four characters for an analyst the case is not assigned to", async () => {
    // case_003 is assigned to Kim.
    const forLee = await viewCase(lee, "case_003");
    expect(forLee.idNumber).toBe("••••0003");
    expect(forLee.idNumberMasked).toBe(true);
    expect(JSON.stringify(forLee)).not.toContain("FAKE-N-00003");

    // case_001 is assigned to nobody.
    for (const analyst of [kim, lee]) {
      const unassigned = await viewCase(analyst, "case_001");
      expect(unassigned.idNumber).toBe("••••0001");
      expect(JSON.stringify(unassigned)).not.toContain("FAKE-P-00001");
    }
  });

  test("the assigned analyst and a lead get the full ID number", async () => {
    expect(await viewCase(kim, "case_003")).toMatchObject({ idNumber: "FAKE-N-00003", idNumberMasked: false });
    expect(await viewCase(noor, "case_003")).toMatchObject({ idNumber: "FAKE-N-00003", idNumberMasked: false });
    expect(await viewCase(noor, "case_001")).toMatchObject({ idNumber: "FAKE-P-00001", idNumberMasked: false });
  });

  test("claiming a case unmasks its ID number for that analyst only", async () => {
    await claimKycCase(lee, "case_001");
    expect((await viewCase(lee, "case_001")).idNumber).toBe("FAKE-P-00001");
    expect((await viewCase(kim, "case_001")).idNumber).toBe("••••0001");
  });

  test("the list carries no ID number and no date of birth, for anyone", async () => {
    const raw = await listCases();
    for (const user of [kim, lee, noor]) {
      const sent = JSON.stringify(await viewCases(user));
      for (const kycCase of raw) {
        expect(sent).not.toContain(kycCase.idNumber);
        expect(sent).not.toContain(kycCase.idNumber.slice(-4));
        expect(sent).not.toContain(kycCase.dateOfBirth);
      }
    }
  });
});

test("no audit row contains a full ID number or a date of birth", async () => {
  const raw = await listCases();

  // Every action, completed, refused and failed, by analysts, a lead and an outsider.
  expect(await claimKycCase(kim, "case_001")).toEqual({});
  expect(await approveKycCase(kim, "case_001")).toEqual({});
  expect(await rejectKycCase(kim, "case_003", "ID number FAKE-N-00003 is not valid")).toEqual({});
  expect(await escalateKycCase(lee, "case_006", "Needs a lead")).toEqual({});
  expect(await claimKycCase(noor, "case_005")).toEqual({});
  expect(await approveKycCase(noor, "case_004")).toEqual({});
  expect(await rejectKycCase(noor, "case_009", "Same device three times")).toEqual({});
  expect(await approveKycCase(kim, "case_010")).toEqual({ error: "Case case_010 is already approved" });
  expect(await claimKycCase(lee, "case_002")).toEqual({});
  // Views: full (audited) and masked (not audited).
  for (const user of [kim, lee, noor]) {
    await viewCase(user, "case_003");
    await viewCase(user, "case_001");
  }
  await expect(approveKycCase(lee, "case_002")).rejects.toBeInstanceOf(ForbiddenError);
  for (const user of [lee, sam]) {
    await expect(claimKycCase(user, "case_003")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(approveKycCase(user, "case_007")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(rejectKycCase(user, "case_007", "No")).rejects.toBeInstanceOf(ForbiddenError);
    await expect(escalateKycCase(user, "case_007", "No")).rejects.toBeInstanceOf(ForbiddenError);
  }

  const rows = await listAudit({ limit: 10_000 });
  expect(new Set(rows.map((row) => row.outcome))).toEqual(new Set(["allowed", "completed", "denied", "failed"]));
  expect(new Set(rows.map((row) => row.action))).toEqual(
    new Set(["kyc.claim", "kyc.approve", "kyc.reject", "kyc.escalate", "kyc.viewFullId"]),
  );

  const stored = JSON.stringify(rows);
  for (const kycCase of raw) {
    expect(stored, kycCase.id).not.toContain(kycCase.idNumber);
    expect(stored, kycCase.id).not.toContain(kycCase.dateOfBirth);
  }
  expect(stored).not.toContain("FAKE-");
  expect(stored).not.toMatch(/idNumber|dateOfBirth/i);
});

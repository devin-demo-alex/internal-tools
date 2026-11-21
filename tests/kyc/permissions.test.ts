import { describe, expect, test } from "vitest";
import { TEST_USERS } from "@/platform/auth/test-users";
import type { User } from "@/platform/contracts";
import { can } from "@/platform/policy";
import { startIdentityService } from "./helpers";

process.env.AUDIT_DB_PATH = ":memory:";

const { ForbiddenError } = await import("@/platform/actions");
const { listAudit } = await import("@/platform/audit");
const { getCase } = await import("@/platform/services/identity");
const { approveKycCase, claimKycCase, escalateKycCase, rejectKycCase, viewCase, viewCases } =
  await import("@/app/kyc/actions");
const { permissions } = await import("@/app/kyc/permissions");

startIdentityService();

const KIM = "kim@example.test";
const LEE = "lee@example.test";
const NOOR = "noor@example.test";

// Cases in the fake identity service.
const UNASSIGNED = "case_001"; // open, nobody assigned, risk 12
const KIMS_LOW_RISK = "case_003"; // open, assigned to Kim, risk 45
const LEES_HIGH_RISK = "case_006"; // open, assigned to Lee, risk 81
const KIMS_APPROVED = "case_010"; // approved, assigned to Kim, risk 22
const LEES_ESCALATED = "case_014"; // escalated, assigned to Lee, risk 83

type Outcome = { error?: string };
type Action = "kyc.claim" | "kyc.approve" | "kyc.reject" | "kyc.escalate";

const run: Record<Action, (user: User, caseId: string) => Promise<Outcome>> = {
  "kyc.claim": (user, caseId) => claimKycCase(user, caseId),
  "kyc.approve": (user, caseId) => approveKycCase(user, caseId),
  "kyc.reject": (user, caseId) => rejectKycCase(user, caseId, "Not acceptable"),
  "kyc.escalate": (user, caseId) => escalateKycCase(user, caseId, "Needs a lead"),
};

// The audit log is kept for the whole file and case ids repeat after each reset,
// so every check counts only the rows its own call added.
async function auditOutcomes(user: User, action: Action, caseId: string) {
  const rows = await listAudit({
    actorEmail: user.email,
    app: "kyc",
    action,
    resourceId: caseId,
    limit: 10_000,
  });
  return rows.map((row) => row.outcome);
}

/** The call succeeds and writes exactly one `allowed` and one `completed` entry. */
async function expectAllowed(user: User, action: Action, caseId: string) {
  const auditBefore = await auditOutcomes(user, action, caseId);
  expect(await run[action](user, caseId)).toEqual({});
  const auditAfter = await auditOutcomes(user, action, caseId);
  const added = auditAfter.slice(0, auditAfter.length - auditBefore.length);
  expect(added.sort()).toEqual(["allowed", "completed"]);
}

/** The call is refused, writes exactly one `denied` entry, and changes nothing. */
async function expectRefused(user: User, action: Action, caseId: string) {
  const caseBefore = await getCase(caseId);
  const auditBefore = await auditOutcomes(user, action, caseId);
  await expect(run[action](user, caseId)).rejects.toBeInstanceOf(ForbiddenError);
  const auditAfter = await auditOutcomes(user, action, caseId);
  expect(auditAfter.slice(0, auditAfter.length - auditBefore.length)).toEqual(["denied"]);
  expect(await getCase(caseId)).toEqual(caseBefore);
}

/** Every test user in AGENTS.md: those listed are allowed, everyone else is refused. */
function everyUser(
  title: string,
  action: Action,
  caseId: string,
  allowed: string[],
  check: (user: User) => Promise<void>,
) {
  describe(title, () => {
    for (const user of TEST_USERS) {
      const expected = allowed.includes(user.email);
      test(`${user.name} is ${expected ? "allowed" : "refused"}`, async () => {
        if (expected) {
          await expectAllowed(user, action, caseId);
          await check(user);
        } else {
          await expectRefused(user, action, caseId);
        }
      });
    }
  });
}

test("the app has exactly these six actions", () => {
  expect(Object.keys(permissions).sort()).toEqual([
    "kyc.approve",
    "kyc.claim",
    "kyc.escalate",
    "kyc.reject",
    "kyc.view",
    "kyc.viewFullId",
  ]);
});

describe("kyc.view", () => {
  for (const user of TEST_USERS) {
    const expected = [KIM, LEE, NOOR].includes(user.email);
    test(`${user.name} is ${expected ? "allowed" : "refused"}`, async () => {
      expect(can(user, permissions, "kyc.view")).toBe(expected);
      if (expected) {
        expect(await viewCases(user)).toHaveLength(15);
        expect((await viewCase(user, UNASSIGNED)).id).toBe(UNASSIGNED);
      } else {
        await expect(viewCases(user)).rejects.toBeInstanceOf(ForbiddenError);
        await expect(viewCase(user, UNASSIGNED)).rejects.toBeInstanceOf(ForbiddenError);
      }
    });
  }
});

everyUser("kyc.claim, on an unassigned case", "kyc.claim", UNASSIGNED, [KIM, LEE, NOOR], async (user) => {
  expect((await getCase(UNASSIGNED)).assignedTo).toBe(user.email);
});

everyUser("kyc.claim, on a case assigned to Kim", "kyc.claim", KIMS_LOW_RISK, [], async () => {});

everyUser(
  "kyc.approve, on a case assigned to Kim with a risk score of 45",
  "kyc.approve",
  KIMS_LOW_RISK,
  [KIM, NOOR],
  async (user) => {
    expect(await getCase(KIMS_LOW_RISK)).toMatchObject({ status: "approved", decidedBy: user.email });
  },
);

everyUser(
  "kyc.approve, on a case assigned to Lee with a risk score of 81",
  "kyc.approve",
  LEES_HIGH_RISK,
  [NOOR],
  async (user) => {
    expect(await getCase(LEES_HIGH_RISK)).toMatchObject({ status: "approved", decidedBy: user.email });
  },
);

everyUser("kyc.approve, on an unassigned open case", "kyc.approve", UNASSIGNED, [NOOR], async () => {
  expect((await getCase(UNASSIGNED)).status).toBe("approved");
});

everyUser(
  "kyc.reject, on a case assigned to Lee with a risk score of 81",
  "kyc.reject",
  LEES_HIGH_RISK,
  [LEE, NOOR],
  async (user) => {
    const rejected = await getCase(LEES_HIGH_RISK);
    expect(rejected).toMatchObject({ status: "rejected", decidedBy: user.email });
    expect(rejected.notes).toContain("Not acceptable");
  },
);

everyUser("kyc.reject, on an unassigned open case", "kyc.reject", UNASSIGNED, [NOOR], async () => {
  expect((await getCase(UNASSIGNED)).status).toBe("rejected");
});

everyUser("kyc.escalate, on a case assigned to Kim", "kyc.escalate", KIMS_LOW_RISK, [KIM], async (user) => {
  const escalated = await getCase(KIMS_LOW_RISK);
  expect(escalated).toMatchObject({ status: "escalated", decidedBy: user.email });
  expect(escalated.notes).toContain("Needs a lead");
});

everyUser("kyc.escalate, on an unassigned case", "kyc.escalate", UNASSIGNED, [], async () => {});

describe("a lead decides open cases only", () => {
  const noor = TEST_USERS.find((user) => user.email === NOOR)!;
  for (const action of ["kyc.approve", "kyc.reject"] as const) {
    for (const caseId of [KIMS_APPROVED, LEES_ESCALATED]) {
      test(`Noor is refused ${action} on ${caseId}`, async () => {
        await expectRefused(noor, action, caseId);
      });
    }
  }
});

describe("the analyst approval limit is a risk score below 80", () => {
  const kim = TEST_USERS.find((user) => user.email === KIM)!;
  const noor = TEST_USERS.find((user) => user.email === NOOR)!;
  const mine = { id: "case_x", status: "open", assignedTo: KIM };

  test("79 is allowed, 80 is refused", () => {
    expect(can(kim, permissions, "kyc.approve", { ...mine, riskScore: 79 })).toBe(true);
    expect(can(kim, permissions, "kyc.approve", { ...mine, riskScore: 80 })).toBe(false);
  });

  test("the limit does not apply to rejecting, escalating, or to a lead", () => {
    const risky = { ...mine, riskScore: 100 };
    expect(can(kim, permissions, "kyc.reject", risky)).toBe(true);
    expect(can(kim, permissions, "kyc.escalate", risky)).toBe(true);
    expect(can(noor, permissions, "kyc.approve", risky)).toBe(true);
  });

  test("a missing resource is refused", () => {
    for (const action of ["kyc.claim", "kyc.approve", "kyc.reject", "kyc.escalate"]) {
      expect(can(kim, permissions, action)).toBe(false);
      expect(can(noor, permissions, action)).toBe(false);
    }
  });
});

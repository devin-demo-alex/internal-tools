import { getAuditDb } from "./db";
import { auditEvents, type AuditOutcome } from "./schema";

// Made-up audit history for demos. It tells the story behind the data the mock
// services start with: who requested, claimed, decided and toggled what.
// Insert only. It holds no ID numbers and no dates of birth.

type DemoRow = {
  at: string;
  actorEmail: string;
  app: string;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome: AuditOutcome;
  before: unknown;
  after: unknown;
};

/** Whole days before today, and a UTC time of day as "HH:MM". */
type When = [daysAgo: number, time: string];

type Target = { type: string; id: string; state?: Record<string, unknown> };

const SAM = "sam@example.test";
const PAT = "pat@example.test";
const RAVI = "ravi@example.test";
const KIM = "kim@example.test";
const LEE = "lee@example.test";
const NOOR = "noor@example.test";
const ELI = "eli@example.test";
const MIA = "mia@example.test";
const ADA = "ada@example.test";

const DAY_MS = 24 * 60 * 60 * 1000;

/** The rows runAction would have written for the story, oldest first. */
export function buildDemoAuditRows(now: Date = new Date()): DemoRow[] {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const rows: DemoRow[] = [];

  const add = (
    [daysAgo, time]: When,
    seconds: number,
    actorEmail: string,
    action: string,
    target: Target,
    outcome: AuditOutcome,
    before?: unknown,
    after?: unknown,
    resourceId = target.id,
  ) => {
    const [hours, minutes] = time.split(":").map(Number);
    rows.push({
      at: new Date(
        today - daysAgo * DAY_MS + ((hours * 60 + minutes) * 60 + seconds) * 1000,
      ).toISOString(),
      actorEmail,
      app: action.split(".")[0],
      action,
      resourceType: target.type,
      resourceId,
      outcome,
      before: before ?? null,
      after: after ?? null,
    });
  };

  /** An action that ran: an allowed row, then a completed row. */
  const done = (
    when: When,
    actor: string,
    action: string,
    target: Target,
    change: { before?: unknown; after?: unknown; resourceId?: string } = {},
  ) => {
    add(when, 0, actor, action, target, "allowed", target.state);
    add(when, 1, actor, action, target, "completed", change.before, change.after, change.resourceId);
  };

  /** An action the back-end service refused: an allowed row, then a failed row. */
  const failed = (when: When, actor: string, action: string, target: Target, error: string) => {
    add(when, 0, actor, action, target, "allowed", target.state);
    add(when, 1, actor, action, target, "failed", undefined, { error });
  };

  /** An action the permission check refused: one denied row. */
  const denied = (when: When, actor: string, action: string, target: Target) => {
    add(when, 0, actor, action, target, "denied");
  };

  const newRefund: Target = { type: "refund", id: "new" };
  const refund = (id: string, requestedBy: string): Target => ({
    type: "refund",
    id,
    state: { status: "requested", requestedBy },
  });
  const requested = (when: When, actor: string, id: string, paymentId: string, amount: number) =>
    done(when, actor, "refunds.request", newRefund, {
      resourceId: id,
      after: { id, paymentId, amount, status: "requested" },
    });
  const decidedRefund = (when: When, actor: string, target: Target, status: string) =>
    done(when, actor, status === "approved" ? "refunds.approve" : "refunds.reject", target, {
      before: { status: "requested" },
      after: { status },
    });

  const kycCase = (id: string, riskScore: number, assignedTo: string | null): Target => ({
    type: "kyc-case",
    id,
    state: { status: "open", assignedTo, riskScore },
  });
  const claimed = (when: When, actor: string, id: string, riskScore: number) =>
    done(when, actor, "kyc.claim", kycCase(id, riskScore, null), {
      before: { assignedTo: null },
      after: { assignedTo: actor },
    });
  const decidedCase = (when: When, actor: string, action: string, target: Target, status: string) =>
    done(when, actor, action, target, { before: { status: "open" }, after: { status } });

  /** Opening a case with the full ID number shown. No before or after values, as in the app. */
  const viewedFullId = (when: When, actor: string, target: Target) =>
    done(when, actor, "kyc.viewFullId", target);

  const flag = (key: string, environment: string): Target => ({
    type: "flag",
    id: `${key}:${environment}`,
    state: { environment },
  });
  const toggled = (when: When, actor: string, target: Target, enabled: boolean) =>
    done(when, actor, "flags.toggle", target, {
      before: { enabled: !enabled },
      after: { enabled },
    });

  // Seven days ago
  toggled([7, "09:05"], ELI, flag("new-onboarding-flow", "staging"), true);
  requested([7, "09:30"], PAT, "ref_005", "pay_007", 91500);
  claimed([7, "10:10"], KIM, "case_010", 22);
  decidedRefund([7, "13:00"], RAVI, refund("ref_005", PAT), "rejected");
  decidedCase([7, "14:20"], KIM, "kyc.approve", kycCase("case_010", 22, KIM), "approved");

  // Six days ago
  toggled([6, "09:15"], ELI, flag("instant-payouts", "staging"), true);
  // An engineer tries to change a production flag.
  denied([6, "09:40"], ELI, "flags.toggle", flag("instant-payouts", "production"));
  claimed([6, "10:05"], LEE, "case_011", 88);
  requested([6, "14:00"], SAM, "ref_004", "pay_005", 76000);
  decidedCase([6, "14:40"], LEE, "kyc.reject", kycCase("case_011", 88, LEE), "rejected");
  decidedRefund([6, "16:45"], PAT, refund("ref_004", SAM), "approved");

  // Five days ago
  claimed([5, "09:20"], KIM, "case_012", 74);
  requested([5, "11:00"], SAM, "ref_003", "pay_003", 50000);
  // pay_005 was already refunded in full by ref_004.
  failed(
    [5, "11:30"],
    SAM,
    "refunds.request",
    newRefund,
    "Refund of 1000 exceeds the refundable amount of 0 on payment pay_005",
  );
  // The assigned analyst opens the case, which shows the full ID number. The
  // row records who saw which case, never the number itself.
  viewedFullId([5, "14:45"], KIM, kycCase("case_012", 74, KIM));
  decidedCase([5, "15:00"], KIM, "kyc.escalate", kycCase("case_012", 74, KIM), "escalated");

  // Four days ago
  decidedRefund([4, "08:15"], RAVI, refund("ref_003", SAM), "approved");
  // An approver who is not a support agent tries to request a refund.
  denied([4, "08:40"], RAVI, "refunds.request", newRefund);
  claimed([4, "10:00"], LEE, "case_013", 18);
  // Kim opened the case before Lee claimed it and pressed Claim just after.
  failed(
    [4, "10:01"],
    KIM,
    "kyc.claim",
    kycCase("case_013", 18, null),
    "Case case_013 is already assigned to lee@example.test",
  );
  denied([4, "10:50"], ELI, "flags.toggle", flag("new-onboarding-flow", "production"));
  toggled([4, "11:15"], MIA, flag("new-onboarding-flow", "production"), true);
  decidedCase([4, "11:30"], LEE, "kyc.approve", kycCase("case_013", 18, LEE), "approved");

  // Three days ago
  claimed([3, "09:10"], LEE, "case_014", 83);
  viewedFullId([3, "15:35"], LEE, kycCase("case_014", 83, LEE));
  // An analyst tries to approve a high-risk case, then escalates it instead.
  denied([3, "15:40"], LEE, "kyc.approve", kycCase("case_014", 83, LEE));
  decidedCase([3, "16:00"], LEE, "kyc.escalate", kycCase("case_014", 83, LEE), "escalated");
  // The lead opens the escalated case.
  viewedFullId([3, "16:30"], NOOR, {
    type: "kyc-case",
    id: "case_014",
    state: { status: "escalated", assignedTo: LEE, riskScore: 83 },
  });

  // Two days ago
  requested([2, "09:00"], SAM, "ref_001", "pay_001", 2500);
  claimed([2, "09:30"], KIM, "case_003", 45);
  requested([2, "10:30"], PAT, "ref_002", "pay_003", 100000);
  // Someone tries to approve their own refund.
  denied([2, "10:45"], PAT, "refunds.approve", refund("ref_002", PAT));
  claimed([2, "11:20"], LEE, "case_006", 81);
  denied([2, "11:45"], LEE, "kyc.approve", kycCase("case_006", 81, LEE));
  // An analyst tries to claim a case that already belongs to a colleague.
  denied([2, "13:10"], KIM, "kyc.claim", kycCase("case_006", 81, LEE));
  toggled([2, "16:05"], ELI, flag("dark-mode-dashboard", "staging"), true);

  // Yesterday
  // A platform admin reads everything in the admin centre but changes nothing in an app.
  denied([1, "10:15"], ADA, "flags.toggle", flag("refund-auto-approve", "production"));
  requested([1, "15:20"], SAM, "ref_006", "pay_010", 4300);

  return rows.sort((a, b) => a.at.localeCompare(b.at));
}

/**
 * Fills an empty audit log with the demo rows and returns how many it added.
 * A log that already has rows is left as it is, so this never runs twice.
 */
export function seedDemoAudit(now: Date = new Date()): number {
  const { sqlite, orm } = getAuditDb();
  const count = sqlite.prepare("SELECT COUNT(*) AS n FROM audit_events");
  // One immediate transaction, so two processes starting together cannot both seed.
  const seed = sqlite.transaction(() => {
    if ((count.get() as { n: number }).n > 0) return 0;
    const rows = buildDemoAuditRows(now);
    for (const row of rows) orm.insert(auditEvents).values(row).run();
    return rows.length;
  });
  return seed.immediate();
}

/** Called when the web app starts. Does nothing unless DEMO_SEED is "true". */
export function seedDemoAuditIfEnabled(): number {
  return process.env.DEMO_SEED === "true" ? seedDemoAudit() : 0;
}

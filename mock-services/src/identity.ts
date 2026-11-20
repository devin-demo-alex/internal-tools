import type { CaseDecision, CaseStatus, IdentityCase } from "../../src/platform/services/identity";
import { createApp, oneOf, Refusal, requiredString } from "./app";

const CASE_STATUSES: readonly CaseStatus[] = ["open", "approved", "rejected", "escalated"];
const DECISIONS: readonly CaseDecision[] = ["approve", "reject", "escalate"];
const STATUS_AFTER: Record<CaseDecision, CaseStatus> = {
  approve: "approved",
  reject: "rejected",
  escalate: "escalated",
};

type SeedRow = [
  customerName: string,
  dateOfBirth: string,
  documentType: string,
  riskScore: number,
  status: CaseStatus,
  assignedTo: string | null,
  notes: string[],
  decidedBy?: string,
  decidedAt?: string,
];

const rows: SeedRow[] = [
  ["Marigold Thistlewood", "1988-03-14", "passport", 12, "open", null, []],
  ["Nico Starling-Voss", "1975-11-02", "driving_licence", 86, "open", null, ["Address does not match the document"]],
  ["Ophelia Dunmarrow", "1993-07-21", "national_id", 45, "open", "kim@example.test", []],
  ["Percival Ashgrove", "1969-01-30", "passport", 92, "open", null, ["Document photo is unreadable"]],
  ["Quenby Larkspur", "2001-09-09", "driving_licence", 8, "open", null, []],
  ["Rosalind Emberly", "1984-05-17", "passport", 81, "open", "lee@example.test", ["Name differs across two documents"]],
  ["Silas Wrenfield", "1990-12-25", "national_id", 33, "open", null, []],
  ["Tamsin Greyholt", "1979-08-04", "passport", 67, "open", null, []],
  ["Ulric Fenwater", "1996-02-11", "driving_licence", 95, "open", null, ["Three applications from the same device"]],
  ["Verity Coldstream", "1987-06-28", "national_id", 22, "approved", "kim@example.test", ["Documents verified"], "kim@example.test", "2026-01-20T10:15:00.000Z"],
  ["Wendell Harrowgate", "1972-10-19", "passport", 88, "rejected", "lee@example.test", ["Document failed the authenticity check"], "lee@example.test", "2026-01-21T14:40:00.000Z"],
  ["Xanthe Millbrook", "1999-04-06", "driving_licence", 74, "escalated", "kim@example.test", ["Needs a lead to review the source of funds"], "kim@example.test", "2026-01-22T09:05:00.000Z"],
  ["Yorick Stonehaven", "1981-07-13", "national_id", 18, "approved", "lee@example.test", [], "lee@example.test", "2026-01-23T11:30:00.000Z"],
  ["Zinnia Blackwood-Hale", "1994-01-08", "passport", 83, "escalated", "lee@example.test", ["Possible match on a watchlist test entry"], "lee@example.test", "2026-01-24T16:00:00.000Z"],
  ["Alder Pennywhistle", "1966-09-27", "driving_licence", 51, "open", null, []],
];

const seedCases: IdentityCase[] = rows.map(
  ([customerName, dateOfBirth, documentType, riskScore, status, assignedTo, notes, decidedBy, decidedAt], index) => {
    const n = String(index + 1).padStart(3, "0");
    return {
      id: `case_${n}`,
      customerRef: `CUST-${1000 + index + 1}`,
      customerName,
      dateOfBirth,
      documentType,
      idNumber: `FAKE-${documentType === "passport" ? "P" : documentType === "national_id" ? "N" : "D"}-00${n}`,
      riskScore,
      status,
      assignedTo,
      notes,
      decidedBy: decidedBy ?? null,
      decidedAt: decidedAt ?? null,
    };
  },
);

export function buildIdentityService() {
  let cases: IdentityCase[] = [];
  const reset = () => {
    cases = structuredClone(seedCases);
  };
  reset();

  const findCase = (id: string) => {
    const found = cases.find((c) => c.id === id);
    if (!found) throw new Refusal(404, `Case ${id} not found`);
    return found;
  };

  const app = createApp();

  app.post("/__reset", async () => {
    reset();
    return { ok: true };
  });

  app.get<{ Querystring: { status?: string } }>("/cases", async (request) => {
    const { status } = request.query;
    if (status === undefined) return cases;
    const wanted = oneOf(status, CASE_STATUSES, "status");
    return cases.filter((c) => c.status === wanted);
  });

  app.get<{ Params: { id: string } }>("/cases/:id", async (request) => findCase(request.params.id));

  app.post<{ Params: { id: string } }>("/cases/:id/claim", async (request) => {
    const found = findCase(request.params.id);
    const analyst = requiredString(request.body, "analyst");
    if (found.assignedTo !== null) {
      throw new Refusal(409, `Case ${found.id} is already assigned to ${found.assignedTo}`);
    }
    found.assignedTo = analyst;
    return found;
  });

  app.post<{ Params: { id: string } }>("/cases/:id/decision", async (request) => {
    const found = findCase(request.params.id);
    const body = request.body as Record<string, unknown> | undefined;
    const decision = oneOf(body?.decision, DECISIONS, "decision");
    const by = requiredString(body, "by");
    const note = body?.note;
    if (note !== undefined && typeof note !== "string") {
      throw new Refusal(400, "note must be text");
    }
    if (found.status !== "open") {
      throw new Refusal(409, `Case ${found.id} is already ${found.status}`);
    }
    found.status = STATUS_AFTER[decision];
    found.decidedBy = by;
    found.decidedAt = new Date().toISOString();
    if (note && note.trim() !== "") found.notes.push(note.trim());
    return found;
  });

  return app;
}

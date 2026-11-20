import { expect, test } from "vitest";
import { listPeople } from "@/platform/directory";

test("listPeople returns the nine test users with their groups", () => {
  expect(listPeople().map((person) => [person.name, person.email, person.groups])).toEqual([
    ["Sam Agent", "sam@example.test", ["support-agents"]],
    ["Pat Both", "pat@example.test", ["support-agents", "refund-approvers"]],
    ["Ravi Approver", "ravi@example.test", ["refund-approvers"]],
    ["Kim Analyst", "kim@example.test", ["kyc-analysts"]],
    ["Lee Analyst", "lee@example.test", ["kyc-analysts"]],
    ["Noor Lead", "noor@example.test", ["kyc-leads"]],
    ["Eli Engineer", "eli@example.test", ["engineers"]],
    ["Mia Release", "mia@example.test", ["engineers", "release-managers"]],
    ["Ada Admin", "ada@example.test", ["platform-admins"]],
  ]);
});

test("changing a returned person does not change the directory", () => {
  const [first] = listPeople();
  first.name = "Someone Else";
  first.groups.push("platform-admins");
  listPeople().pop();

  const again = listPeople();
  expect(again).toHaveLength(9);
  expect(again[0]).toEqual({
    name: "Sam Agent",
    email: "sam@example.test",
    groups: ["support-agents"],
  });
});

test("sign-in knows exactly the people in the directory", async () => {
  const { TEST_USERS, findTestUser } = await import("@/platform/auth/test-users");
  expect(TEST_USERS).toEqual(listPeople());
  for (const person of listPeople()) {
    expect(findTestUser(person.email)).toEqual(person);
  }
  expect(findTestUser("nobody@example.test")).toBeNull();
});

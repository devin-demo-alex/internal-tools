import type { User } from "@/platform/contracts";

// Stand-ins for people and groups in Microsoft Entra. Made-up data only.
export const TEST_USERS: readonly User[] = [
  { name: "Sam Agent", email: "sam@example.test", groups: ["support-agents"] },
  {
    name: "Pat Both",
    email: "pat@example.test",
    groups: ["support-agents", "refund-approvers"],
  },
  {
    name: "Ravi Approver",
    email: "ravi@example.test",
    groups: ["refund-approvers"],
  },
  { name: "Kim Analyst", email: "kim@example.test", groups: ["kyc-analysts"] },
  { name: "Lee Analyst", email: "lee@example.test", groups: ["kyc-analysts"] },
  { name: "Noor Lead", email: "noor@example.test", groups: ["kyc-leads"] },
  { name: "Eli Engineer", email: "eli@example.test", groups: ["engineers"] },
  {
    name: "Mia Release",
    email: "mia@example.test",
    groups: ["engineers", "release-managers"],
  },
  { name: "Ada Admin", email: "ada@example.test", groups: ["platform-admins"] },
];

export function findTestUser(email: string): User | null {
  const user = TEST_USERS.find((candidate) => candidate.email === email);
  return user
    ? { name: user.name, email: user.email, groups: [...user.groups] }
    : null;
}

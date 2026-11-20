import type { User } from "@/platform/contracts";
import { listPeople } from "@/platform/directory";

// Stand-ins for people and groups in Microsoft Entra, read from the directory.
export const TEST_USERS: readonly User[] = listPeople();

export function findTestUser(email: string): User | null {
  const user = TEST_USERS.find((candidate) => candidate.email === email);
  return user
    ? { name: user.name, email: user.email, groups: [...user.groups] }
    : null;
}

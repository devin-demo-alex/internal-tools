import { expect, test } from "vitest";
import type { User } from "@/platform/contracts";

test("a User carries its groups", () => {
  const user: User = {
    name: "Sam Agent",
    email: "sam@example.test",
    groups: ["support-agents"],
  };
  expect(user.groups).toEqual(["support-agents"]);
});

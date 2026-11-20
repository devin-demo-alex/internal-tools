import { signInAction } from "./login-action";
import { TEST_USERS } from "./test-users";

/** The fake sign-in screen: one button per test user. */
export function LoginForm() {
  return (
    <form action={signInAction}>
      <ul className="flex flex-col gap-2">
        {TEST_USERS.map((user) => (
          <li key={user.email}>
            <button
              type="submit"
              name="email"
              value={user.email}
              className="w-full rounded border px-4 py-2 text-left hover:bg-neutral-100"
            >
              <span className="font-medium">{user.name}</span>{" "}
              <span className="text-neutral-600">{user.email}</span>
              <span className="block text-sm text-neutral-600">
                {user.groups.join(", ")}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </form>
  );
}

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import type { User } from "@/platform/contracts";
import {
  createSessionToken,
  readSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
} from "./session";
import { findTestUser } from "./test-users";

export const LOGIN_PATH = "/login";

/** The signed-in user, or null. */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Checking expiry reads the clock, which must happen at request time.
  await connection();
  const email = readSessionToken(token, Date.now());
  return email ? findTestUser(email) : null;
});

/** The signed-in user. Sends the browser to the login page if there is none. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect(LOGIN_PATH);
  return user;
}

/** Starts a session. Only callable from a Server Function or Route Handler. */
export async function signIn(email: string): Promise<User | null> {
  const user = findTestUser(email);
  if (!user) return null;
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, createSessionToken(user.email, Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return user;
}

/** Ends the session. Only callable from a Server Function or Route Handler. */
export async function signOut(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

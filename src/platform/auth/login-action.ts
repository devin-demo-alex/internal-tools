"use server";

import { redirect } from "next/navigation";
import { LOGIN_PATH, signIn } from "./current-user";

export async function signInAction(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const user = typeof email === "string" ? await signIn(email) : null;
  redirect(user ? "/" : LOGIN_PATH);
}

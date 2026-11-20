import { forbidden } from "next/navigation";
import { requireUser } from "@/platform/auth";
import type { User } from "@/platform/contracts";
import { canOpenApp, getApp } from "@/platform/registry";
import { ForbiddenError } from "./errors";

/** The signed-in user, if they may open the app. Otherwise the 403 page. */
export async function requireAppAccess(appId: string): Promise<User> {
  const user = await requireUser();
  const app = getApp(appId);
  if (!app || !canOpenApp(user, app)) forbidden();
  return user;
}

/** Runs `fn`; a ForbiddenError from runAction becomes the 403 page. */
export async function forbiddenPageOnDenied<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ForbiddenError) forbidden();
    throw error;
  }
}

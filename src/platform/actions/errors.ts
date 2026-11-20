import type { DenyReason } from "@/platform/policy";

/** Thrown by runAction when the permission check refuses the action. */
export class ForbiddenError extends Error {
  readonly app: string;
  readonly action: string;
  readonly reason: DenyReason;

  constructor(app: string, action: string, reason: DenyReason) {
    super(`Not allowed: ${app}/${action}`);
    this.name = "ForbiddenError";
    this.app = app;
    this.action = action;
    this.reason = reason;
  }
}

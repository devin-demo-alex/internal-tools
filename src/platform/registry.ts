import { permissions as adminPermissions } from "@/app/admin/permissions";
import { permissions as flagsPermissions } from "@/app/flags/permissions";
import { pageExists as kycPageExists } from "@/app/kyc/page-exists";
import { permissions as kycPermissions } from "@/app/kyc/permissions";
import { pageExists as refundsPageExists } from "@/app/refunds/page-exists";
import { permissions as refundsPermissions } from "@/app/refunds/permissions";
import type { AppEntry, User } from "@/platform/contracts";
import { can, type Permissions } from "@/platform/policy";

type Registration = {
  entry: AppEntry;
  permissions: Permissions;
  /** Optional. False when the path names something in the app that does not exist. */
  pageExists?: (pathname: string) => Promise<boolean>;
};

const registrations: Registration[] = [
  {
    entry: {
      id: "refunds",
      name: "Refunds",
      path: "/refunds",
      description: "Request and approve customer refunds.",
      openGroups: ["support-agents", "refund-approvers"],
    },
    permissions: refundsPermissions,
    pageExists: refundsPageExists,
  },
  {
    entry: {
      id: "kyc",
      name: "KYC review",
      path: "/kyc",
      description: "Review identity checks.",
      openGroups: ["kyc-analysts", "kyc-leads"],
    },
    permissions: kycPermissions,
    pageExists: kycPageExists,
  },
  {
    entry: {
      id: "flags",
      name: "Feature flags",
      path: "/flags",
      description: "Turn features on and off.",
      openGroups: ["engineers", "release-managers"],
    },
    permissions: flagsPermissions,
  },
  {
    entry: {
      id: "admin",
      name: "Admin",
      path: "/admin",
      description: "Platform administration and the audit log.",
      openGroups: ["platform-admins"],
    },
    permissions: adminPermissions,
  },
];

/** Every app on the platform. */
export const apps: AppEntry[] = registrations.map(({ entry }) => entry);

export function getApp(id: string): AppEntry | undefined {
  return apps.find((app) => app.id === id);
}

/** An app's permission rules, or undefined for an app that is not registered. */
export function getPermissions(appId: string): Permissions | undefined {
  return registrations.find(({ entry }) => entry.id === appId)?.permissions;
}

/** False only when the app says the path names something that does not exist. */
export async function pageExists(app: AppEntry, pathname: string): Promise<boolean> {
  const check = registrations.find(({ entry }) => entry.id === app.id)?.pageExists;
  return check ? check(pathname) : true;
}

export function canOpenApp(user: User | null | undefined, app: AppEntry): boolean {
  return can(user, { open: { groups: app.openGroups } }, "open");
}

/** The apps this user may open. */
export function appsFor(user: User | null | undefined): AppEntry[] {
  return apps.filter((app) => canOpenApp(user, app));
}

import { getCase, ServiceError } from "@/platform/services/identity";

/**
 * False when the path is /kyc/<id> and there is no such case.
 * The platform asks this before the page starts, so the answer is a real 404.
 */
export async function pageExists(pathname: string): Promise<boolean> {
  const id = /^\/kyc\/([^/]+)$/.exec(pathname)?.[1];
  if (!id) return true;
  try {
    await getCase(decodeURIComponent(id));
    return true;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) return false;
    throw error;
  }
}

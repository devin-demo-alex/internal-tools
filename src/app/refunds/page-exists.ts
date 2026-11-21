import { getRefund, ServiceError } from "@/platform/services/payments";

/**
 * False when the path is /refunds/<id> and there is no such refund.
 * The platform asks this before the page starts, so the answer is a real 404.
 */
export async function pageExists(pathname: string): Promise<boolean> {
  const id = /^\/refunds\/([^/]+)$/.exec(pathname)?.[1];
  if (!id) return true;
  try {
    await getRefund(decodeURIComponent(id));
    return true;
  } catch (error) {
    if (error instanceof ServiceError && error.status === 404) return false;
    throw error;
  }
}

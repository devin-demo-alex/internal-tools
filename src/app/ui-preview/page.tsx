import { requireUser } from "@/platform/auth";
import { UiPreview } from "./preview";

// Who may see this page is decided per request, so navigation waits for the server.
export const instant = false;

export default async function UiPreviewPage() {
  const user = await requireUser();
  return <UiPreview userName={user.name} />;
}

/** Runs once when the web app starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { seedDemoAuditIfEnabled } = await import("@/platform/audit/seed-demo");
  seedDemoAuditIfEnabled();
}

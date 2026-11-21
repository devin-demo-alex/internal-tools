import { seedDemoAudit } from "./seed-demo";

// `pnpm seed:demo`: the same seed the web app runs at start-up with DEMO_SEED=true.
const added = seedDemoAudit();
console.log(
  added > 0
    ? `Added ${added} demo rows to audit_events.`
    : "audit_events already has rows. Nothing was added.",
);

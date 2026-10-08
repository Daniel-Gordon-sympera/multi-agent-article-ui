/** Every mock handler the SPA relies on (contract §5.6), merged per area. */
import { accessPolicyHandlers } from "./accessPolicies";
import { authHandlers } from "./auth";
import { jobHandlers } from "./jobs";
import { overviewHandlers } from "./overview";
import { scoutHandlers } from "./scouts";
import { settingsHandlers } from "./settings";
import { signalHandlers } from "./signals";
import { sourceHandlers } from "./sources";

export const handlers = [
  ...authHandlers,
  ...accessPolicyHandlers,
  ...jobHandlers,
  ...signalHandlers,
  ...scoutHandlers,
  ...sourceHandlers,
  ...overviewHandlers,
  ...settingsHandlers,
];

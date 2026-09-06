import { createFlagsDiscoveryEndpoint, getProviderData } from "flags/next";
import { citizenTrackingV2 } from "@/flags.ts";

// What the Vercel Toolbar reads to list the flags and offer a per-session
// override. Answers only a caller that proves FLAGS_SECRET; without the
// variable it is a 401, and the flags themselves keep working.
export const GET = createFlagsDiscoveryEndpoint(() =>
  getProviderData({ citizenTrackingV2 }),
);

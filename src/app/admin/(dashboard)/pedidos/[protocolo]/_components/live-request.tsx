"use client";

import { useRouter } from "next/navigation";
import { useLiveVersion } from "../../../../../_components/use-live-version.ts";
import { requestVersionAction } from "../actions.ts";

const POLL_MS = 10_000;

/**
 * Re-renders the detail page when the request changes under it: the citizen
 * answers a requirement, a colleague moves the andamento. Only the version
 * stamp travels on each poll; the page's own queries run again only when it
 * moved.
 */
export function LiveRequest({
  requestId,
  version,
}: {
  requestId: string;
  version: string;
}) {
  const router = useRouter();
  useLiveVersion(
    () => requestVersionAction(requestId),
    version,
    () => router.refresh(),
    POLL_MS,
  );
  return null;
}

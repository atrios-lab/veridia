"use server";

import { headers } from "next/headers";
import { kindFromPath } from "@/core/signature/station.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  jobStatusWith,
  linkJobWith,
  requestJobWith,
  type SharedCertificate,
  StationError,
  sharedForUserWith,
} from "@/lib/signing-stations.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * Signing with an A3 shared through a station (decision of 16/11/2026),
 * from any screen that signs with A3: the certificates shared with this
 * person, the request, and the wait for the answer. Who may use each one
 * is the station's rule, checked here on every step.
 */

export async function sharedCertificatesAction(): Promise<SharedCertificate[]> {
  const session = await getSession();
  if (!session) return [];
  const tenant = await getTenant();
  return sharedForUserWith(db, tenant.slug, session.user.id).catch(() => []);
}

export async function requestStationSignatureAction(input: {
  stationId: string;
  certificateKey: string;
  toBeSigned: string;
  title: string;
}): Promise<
  { status: "asked"; id: string } | { status: "error"; message: string }
> {
  const session = await getSession();
  if (!session) return { status: "error", message: "Entre de novo no painel." };
  try {
    const tenant = await getTenant();
    // The kind of document comes from the panel screen the request was made
    // on (the page address the browser sends), not from a field the screen
    // fills in. It is a sorting of the use, recorded in the history; the
    // hard limits are the person, the hours, the date and the release.
    const referer = (await headers()).get("referer") ?? "";
    let path = "";
    try {
      path = new URL(referer).pathname;
    } catch {
      path = "";
    }
    const kind = kindFromPath(path);
    const id = await requestJobWith(
      db,
      tenant.slug,
      { ...input, kind },
      {
        id: session.user.id,
        name: session.user.name,
      },
    );
    return { status: "asked", id };
  } catch (error) {
    if (error instanceof StationError) {
      return { status: "error", message: error.message };
    }
    console.error("assinador.station-request", error);
    return { status: "error", message: "Não foi possível pedir a assinatura." };
  }
}

export async function stationSignatureStatusAction(id: string) {
  const session = await getSession();
  if (!session) {
    return { status: "falhou" as const, message: "Entre de novo no painel." };
  }
  const tenant = await getTenant();
  return jobStatusWith(db, tenant.slug, id, session.user.id);
}

/** After the platform saved the signed document: the record says which. */
export async function linkStationJobAction(
  jobId: string,
  signedId: string,
): Promise<void> {
  const session = await getSession();
  if (!session) return;
  const tenant = await getTenant();
  await linkJobWith(db, tenant.slug, jobId, session.user.id, signedId).catch(
    (error) => console.error("assinador.station-link", error),
  );
}

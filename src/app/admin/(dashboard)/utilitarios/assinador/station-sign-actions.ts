"use server";

import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  jobStatusWith,
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
    const id = await requestJobWith(db, tenant.slug, input, {
      id: session.user.id,
      name: session.user.name,
    });
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

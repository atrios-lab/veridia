"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  isStationMode,
  RELEASE_HOURS,
  releaseUntil,
} from "@/core/signature/station.ts";
import { db } from "@/db/index.ts";
import { getSession } from "@/lib/session.ts";
import {
  createStationWith,
  releaseWith,
  revokeStationWith,
  StationError,
  setPolicyWith,
} from "@/lib/signing-stations.ts";
import { getTenant } from "@/lib/tenant.ts";

export type StationState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "error"; message: string };

const NO_PERMISSION = "Só o administrador da serventia cuida dos certificados.";
const PATH = "/admin/configuracoes/certificados";
const GENERIC = "Não foi possível salvar agora. Tente de novo.";

async function admin() {
  const session = await getSession();
  if (
    !session ||
    !can(
      session.user.role ?? "",
      "certificates.manage",
      session.user.permissions,
    )
  )
    return null;
  return session;
}

function failure(error: unknown, where: string): StationState {
  if (error instanceof StationError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

/**
 * A new station (decision of 16/11/2026): the key comes back once, for the
 * screen open on that very computer to hand to its Assinador Veridia.
 */
export async function createStationAction(
  name: string,
): Promise<
  { status: "created"; key: string } | { status: "error"; message: string }
> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  try {
    const tenant = await getTenant();
    const { key } = await createStationWith(
      db,
      tenant.slug,
      name,
      session.user.id,
    );
    revalidatePath(PATH);
    return { status: "created", key };
  } catch (error) {
    const failed = failure(error, "certificados.station-create");
    return {
      status: "error",
      message: failed.status === "error" ? failed.message : GENERIC,
    };
  }
}

/** Whether, how and with whom a certificate of a station is shared. */
export async function setStationPolicyAction(
  _previous: StationState,
  formData: FormData,
): Promise<StationState> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const mode = String(formData.get("modo") ?? "");
  if (!isStationMode(mode)) {
    return { status: "error", message: "Escolha como o uso é autorizado." };
  }
  try {
    const tenant = await getTenant();
    await setPolicyWith(
      db,
      tenant.slug,
      {
        stationId: String(formData.get("stationId") ?? ""),
        certificateKey: String(formData.get("certificateKey") ?? ""),
        shared: formData.get("compartilhar") === "1",
        mode,
        signerIds: formData.getAll("signers").map(String),
      },
      session.user.id,
    );
  } catch (error) {
    return failure(error, "certificados.station-policy");
  }
  revalidatePath(PATH);
  return { status: "saved", message: "Compartilhamento salvo." };
}

/** Releases the use for some hours, or ends the release ("0"). */
export async function releaseStationCertificateAction(
  _previous: StationState,
  formData: FormData,
): Promise<StationState> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const hours = Number(formData.get("horas") ?? "");
  if (hours !== 0 && !(RELEASE_HOURS as readonly number[]).includes(hours)) {
    return { status: "error", message: "Escolha por quanto tempo liberar." };
  }
  try {
    const tenant = await getTenant();
    await releaseWith(
      db,
      tenant.slug,
      {
        stationId: String(formData.get("stationId") ?? ""),
        certificateKey: String(formData.get("certificateKey") ?? ""),
        until: hours ? releaseUntil(hours, new Date()) : null,
      },
      session.user.id,
    );
  } catch (error) {
    return failure(error, "certificados.station-release");
  }
  revalidatePath(PATH);
  return {
    status: "saved",
    message: hours ? `Liberado por ${hours} h.` : "Liberação encerrada.",
  };
}

/** The station switched off: it stops signing for the office. */
export async function revokeStationAction(
  _previous: StationState,
  formData: FormData,
): Promise<StationState> {
  const session = await admin();
  if (!session) return { status: "error", message: NO_PERMISSION };
  try {
    const tenant = await getTenant();
    await revokeStationWith(
      db,
      tenant.slug,
      String(formData.get("stationId") ?? ""),
      session.user.id,
    );
  } catch (error) {
    return failure(error, "certificados.station-revoke");
  }
  revalidatePath(PATH);
  return { status: "saved", message: "Estação desligada." };
}

"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import { db } from "@/db/index.ts";
import { justify } from "@/lib/audit-reason.ts";
import {
  changeSectorsWith,
  RoutingError,
  type SectorChange,
  setCitizenLineWith,
  setConclusionPolicyWith,
} from "@/lib/routing.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";

/**
 * Configurações › Setores and › Assinatura e conclusão (change
 * direcionamento-interno-de-pedidos): only who holds `routing.settings`
 * (the Tabelião/Registrador, whoever he grants it to, and the platform
 * account). Every change goes to the audit with what it was before.
 */

export type SettingsState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const NO_PERMISSION = "Você não tem permissão para mudar o direcionamento.";

async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "routing.settings", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

function done(message: string): SettingsState {
  revalidatePath("/admin", "layout");
  return { status: "success", message };
}

function failed(label: string, error: unknown): SettingsState {
  if (error instanceof RoutingError) {
    return { status: "error", message: error.message };
  }
  console.error(`configuracoes.routing.${label}`, error);
  return {
    status: "error",
    message: "Não foi possível salvar agora. Tente novamente em instantes.",
  };
}

const MESSAGES: Record<SectorChange["op"], string> = {
  create: "Setor criado.",
  rename: "Nome do setor alterado. O nome antigo fica no histórico.",
  hide: "Setor apagado. Os pedidos antigos continuam com o nome dele.",
  restore: "Setor de volta às escolhas.",
  members: "Setores da pessoa salvos.",
};

export async function changeSectorAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const op = String(formData.get("op") ?? "");
  if (op === "hide") {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  const id = String(formData.get("id") ?? "");
  const label = String(formData.get("label") ?? "");
  let change: SectorChange;
  switch (op) {
    case "create":
      change = { op, label };
      break;
    case "rename":
      change = { op, id, label };
      break;
    case "hide":
    case "restore":
      change = { op, id };
      break;
    case "members":
      change = {
        op,
        userId: String(formData.get("userId") ?? ""),
        sectorIds: formData.getAll("sectorIds").map(String),
      };
      break;
    default:
      return { status: "error", message: "Ação desconhecida." };
  }
  try {
    const tenant = await getTenant();
    await changeSectorsWith(
      db,
      tenant.slug,
      tenant.attributions,
      change,
      session.user.id,
    );
    return done(MESSAGES[change.op]);
  } catch (error) {
    return failed("sector", error);
  }
}

export async function saveCitizenLineAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const enabled = formData.get("enabled") === "on";
  try {
    const tenant = await getTenant();
    await setCitizenLineWith(db, tenant.slug, enabled, session.user.id);
    return done(
      enabled
        ? "O cidadão passa a ver o setor e a fase do pedido."
        : "O cidadão vê só o andamento, como antes.",
    );
  } catch (error) {
    return failed("citizen-line", error);
  }
}

export async function saveConclusionPolicyAction(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const mode = formData.get("mode") === "selected" ? "selected" : "all";
  const userIds = formData.getAll("userIds").map(String);
  try {
    const tenant = await getTenant();
    const saved = await setConclusionPolicyWith(
      db,
      tenant.slug,
      mode === "all" ? { mode } : { mode, userIds },
      session.user.id,
    );
    return done(
      saved.mode === "all"
        ? "Todos da equipe com acesso aos pedidos podem assinar e concluir."
        : `Salvo. ${saved.userIds.length} pessoa${saved.userIds.length === 1 ? "" : "s"} pode${saved.userIds.length === 1 ? "" : "m"} assinar e concluir; o Tabelião está sempre na lista.`,
    );
  } catch (error) {
    return failed("conclusion", error);
  }
}

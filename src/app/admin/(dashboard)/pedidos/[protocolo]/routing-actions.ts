"use server";

import { revalidatePath } from "next/cache";
import { can } from "@/core/auth/roles.ts";
import {
  currentRouting,
  holderOf,
  ROUTING_PRIORITIES,
  ROUTING_PURPOSES,
  type RoutingPriority,
  type RoutingPurpose,
} from "@/core/routing/routing.ts";
import { fromZonedDateTime } from "@/core/scheduling/calendar.ts";
import { db } from "@/db/index.ts";
import {
  editRoutingWith,
  type RoutingAlert,
  RoutingError,
  receiveWith,
  routeWith,
  routingAlertsWith,
  routingsOfRequestWith,
  setRequestCitizenLineWith,
  takeWith,
  withdrawRoutingWith,
} from "@/lib/routing.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant, OFFICE_TIME_ZONE } from "@/lib/tenant.ts";

/**
 * The internal routing of a pedido from the panel (change
 * direcionamento-interno-de-pedidos): take it, send it, receive it, change
 * or undo a sending, send it back, and the citizen's line on this pedido.
 * Each re-checks on the server: whoever works the pedidos.
 */

export type RoutingActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

const NO_PERMISSION = "Você não tem permissão para direcionar pedidos.";
const GENERIC_ERROR =
  "Não foi possível salvar agora. Tente novamente em instantes.";

async function authorize() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "requests.manage", session.user.permissions)
  ) {
    return null;
  }
  return session;
}

function me(session: NonNullable<Awaited<ReturnType<typeof authorize>>>) {
  return {
    id: session.user.id,
    chatSector:
      (session.user as { chatSector?: string | null }).chatSector ?? null,
  };
}

function revalidate(): void {
  revalidatePath("/admin", "layout");
}

async function run(
  label: string,
  work: () => Promise<string>,
): Promise<RoutingActionState> {
  try {
    const message = await work();
    revalidate();
    return { status: "success", message };
  } catch (error) {
    if (error instanceof RoutingError) {
      return { status: "error", message: error.message };
    }
    console.error(`pedidos.routing.${label}`, error);
    return { status: "error", message: GENERIC_ERROR };
  }
}

/** "2026-11-24T16:00" typed in the office's clock, as an instant. */
function parseDue(value: string): Date | null | "invalid" {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "invalid";
  const date = fromZonedDateTime(value, OFFICE_TIME_ZONE);
  return Number.isNaN(date.getTime()) ? "invalid" : date;
}

function readRouteForm(formData: FormData) {
  const purpose = String(formData.get("purpose") ?? "");
  const priority = String(formData.get("priority") ?? "normal");
  const toUserId = String(formData.get("toUserId") ?? "");
  const due = parseDue(String(formData.get("dueAt") ?? ""));
  if (!(ROUTING_PURPOSES as readonly string[]).includes(purpose)) {
    throw new RoutingError("Escolha para quê: executar, conferir ou assinar.");
  }
  if (!(ROUTING_PRIORITIES as readonly string[]).includes(priority)) {
    throw new RoutingError("Escolha a prioridade.");
  }
  if (due === "invalid") throw new RoutingError("Confira o prazo.");
  if (due && due.getTime() < Date.now() - 60_000) {
    throw new RoutingError("O prazo já passou: escolha um horário à frente.");
  }
  return {
    toUserId: toUserId || null,
    sectorId: String(formData.get("sectorId") ?? ""),
    purpose: purpose as RoutingPurpose,
    actId: String(formData.get("actId") ?? "") || null,
    priority: priority as RoutingPriority,
    dueAt: due,
    note: String(formData.get("note") ?? ""),
  };
}

/** Sends the pedido (or, with `routingId`, changes a sending). */
export async function routeAction(
  _previous: RoutingActionState,
  formData: FormData,
): Promise<RoutingActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  const requestId = String(formData.get("requestId") ?? "");
  const routingId = String(formData.get("routingId") ?? "");
  return run("route", async () => {
    const input = readRouteForm(formData);
    if (routingId) {
      await editRoutingWith(
        db,
        tenant.slug,
        tenant.attributions,
        routingId,
        input,
        session.user.id,
      );
      return "Direcionamento alterado. O histórico guarda como era antes.";
    }
    await routeWith(
      db,
      tenant.slug,
      tenant.attributions,
      { requestId, ...input },
      session.user.id,
    );
    return input.toUserId
      ? "Pedido direcionado. A pessoa já foi avisada."
      : "Pedido enviado à fila do setor. Quem é do setor já foi avisado.";
  });
}

export async function takeAction(
  requestId: string,
): Promise<RoutingActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  return run("take", async () => {
    await takeWith(
      db,
      tenant.slug,
      tenant.attributions,
      requestId,
      me(session),
    );
    return "O pedido está com você agora.";
  });
}

export async function receiveAction(
  routingId: string,
): Promise<RoutingActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  return run("receive", async () => {
    await receiveWith(
      db,
      tenant.slug,
      tenant.attributions,
      routingId,
      me(session),
    );
    return "Recebido. O pedido está com você.";
  });
}

export async function withdrawRoutingAction(
  routingId: string,
): Promise<RoutingActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  return run("withdraw", async () => {
    await withdrawRoutingWith(db, tenant.slug, routingId, session.user.id);
    return "Direcionamento desfeito. Ele fica riscado no histórico.";
  });
}

/** Sends the pedido back to whoever sent it to me. */
export async function returnAction(
  requestId: string,
): Promise<RoutingActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  return run("return", async () => {
    const current = currentRouting(
      await routingsOfRequestWith(db, tenant.slug, requestId),
    );
    const holder = holderOf(current);
    if (!current || holder?.userId !== session.user.id || !current.fromUserId) {
      throw new RoutingError("Só quem está com o pedido o devolve.");
    }
    if (current.fromUserId === session.user.id) {
      throw new RoutingError("O pedido veio de você mesmo: use Direcionar.");
    }
    if (!current.sectorId) {
      throw new RoutingError("Use Direcionar e escolha o setor.");
    }
    await routeWith(
      db,
      tenant.slug,
      tenant.attributions,
      {
        requestId,
        toUserId: current.fromUserId,
        sectorId: current.sectorId,
        purpose: current.purpose,
        actId: current.actId,
        priority: current.priority,
        dueAt: null,
        note: "",
      },
      session.user.id,
      "return",
    );
    return "Pedido devolvido a quem o mandou.";
  });
}

export async function setCitizenLineAction(
  requestId: string,
  enabled: boolean,
): Promise<RoutingActionState> {
  const session = await authorize();
  if (!session) return { status: "error", message: NO_PERMISSION };
  const tenant = await getTenant();
  return run("citizen-line", async () => {
    await setRequestCitizenLineWith(
      db,
      tenant.slug,
      requestId,
      enabled,
      session.user.id,
    );
    return enabled
      ? "O cidadão volta a ver o setor e a fase."
      : "O cidadão vê só o andamento, como antes.";
  });
}

/** The routing channel's cards, polled by the panel on every screen. */
export async function routingAlertSnapshotAction(): Promise<
  RoutingAlert[] | null
> {
  const session = await authorize();
  if (!session) return null;
  try {
    const tenant = await getTenant();
    return await routingAlertsWith(
      db,
      tenant.slug,
      tenant.attributions,
      me(session),
      can(session.user.role ?? "", "audit.manage", session.user.permissions),
    );
  } catch (error) {
    console.error("alerts.routing-snapshot", error);
    return null;
  }
}

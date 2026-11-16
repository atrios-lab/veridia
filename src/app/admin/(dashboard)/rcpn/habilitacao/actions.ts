"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import { defaultExpiry } from "@/core/publications/expiry.ts";
import { MARRIAGE_BANNS_NOTICE_TYPE } from "@/core/publications/notice-types.ts";
import { publicationFormSchema } from "@/core/publications/publication.ts";
import {
  HABILITACAO_FIELDS,
  reviewHabilitacao,
} from "@/core/rcpn/habilitacao.ts";
import { editalForSite } from "@/core/rcpn/habilitacao-docs.ts";
import { noticeSectors } from "@/core/tenant/gating.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import { notifyIndexNow } from "@/lib/notify-indexnow.ts";
import { createPublication } from "@/lib/publications.ts";
import { HabilitacaoError, habilitacoes } from "@/lib/rcpn-habilitacao.ts";
import { getSession } from "@/lib/session.ts";
import { getSiteOrigin } from "@/lib/site-origin.ts";
import { getTenant, today } from "@/lib/tenant.ts";

export type HabilitacaoState =
  | { status: "idle" }
  | { status: "error"; message: string };

const NO_PERMISSION =
  "Você não tem permissão para a habilitação de casamento. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "rcpn.habilitacao", session.user.permissions)
  ) {
    return undefined;
  }
  const tenant = await getTenant();
  if (!tenant.attributions.includes("RCPN")) return undefined;
  return { session, tenant };
}

const text = (formData: FormData, key: string) =>
  String(formData.get(key) ?? "");

/** Every field of the processo the form sent. */
function typedOf(formData: FormData): Record<string, string> {
  const typed: Record<string, string> = {};
  for (const field of HABILITACAO_FIELDS) {
    const value = formData.get(field.key);
    if (value !== null) typed[field.key] = String(value);
  }
  return typed;
}

const path = (id: string) => `/admin/rcpn/habilitacao/${id}`;

function failure(error: unknown, where: string): HabilitacaoState {
  if (error instanceof HabilitacaoError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

export async function createHabilitacaoAction(
  _previous: HabilitacaoState,
  formData: FormData,
): Promise<HabilitacaoState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let id = "";
  try {
    id = await habilitacoes.create(
      ok.tenant.slug,
      typedOf(formData),
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "rcpn.habilitacao.create");
  }
  revalidatePath("/admin/rcpn/habilitacao");
  redirect(`${path(id)}?aberto=1`);
}

export async function saveHabilitacaoAction(
  _previous: HabilitacaoState,
  formData: FormData,
): Promise<HabilitacaoState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  let changed = 0;
  try {
    changed = await habilitacoes.save(
      ok.tenant.slug,
      id,
      typedOf(formData),
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "rcpn.habilitacao.edit");
  }
  revalidatePath(path(id));
  redirect(`${path(id)}?alterados=${changed}`);
}

/**
 * "Extrair certificado hoje": the date of the certificado, once nothing
 * stops it (CC, art. 1.531). The reason goes in by itself: the act is the
 * certificado, not a correction.
 */
export async function certificadoTodayAction(
  _previous: HabilitacaoState,
  formData: FormData,
): Promise<HabilitacaoState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  const found = await habilitacoes.get(ok.tenant.slug, id);
  if (!found) return { status: "error", message: "Processo não encontrado." };
  const on = today();
  const review = reviewHabilitacao({ ...found.values, certificadoEm: on }, on);
  if (!found.values.editalEm) {
    return {
      status: "error",
      message:
        "Publique o edital antes: o certificado só sai depois da publicação (Lei nº 6.015/1973, art. 67, § 1º).",
    };
  }
  if (review.problems.length > 0) {
    return {
      status: "error",
      message: `Resolva antes: ${review.problems.join(" ")}`,
    };
  }
  try {
    await habilitacoes.save(
      ok.tenant.slug,
      id,
      { certificadoEm: on },
      ok.session.user.id,
      "Certificado de habilitação extraído.",
    );
  } catch (error) {
    return failure(error, "rcpn.habilitacao.certificado");
  }
  revalidatePath(path(id));
  redirect(`${path(id)}?certificado=1`);
}

/**
 * Publishes the edital on the site's proclamas, in the content the CNN
 * allows (art. 122), for the term of the notice type (15 days).
 */
export async function publishEditalAction(
  _previous: HabilitacaoState,
  formData: FormData,
): Promise<HabilitacaoState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  const found = await habilitacoes.get(ok.tenant.slug, id);
  if (!found) return { status: "error", message: "Processo não encontrado." };
  if (found.canceledAt) {
    return { status: "error", message: "Este processo está cancelado." };
  }
  if (found.publicationId) {
    return {
      status: "error",
      message: "O edital deste processo já foi publicado no site.",
    };
  }
  const missing = ([1, 2] as const).flatMap((n) =>
    ["nome", "estadoCivil", "domicilio"]
      .filter((k) => !found.values[`n${n}.${k}`]?.trim())
      .map(() => `${n}º nubente`),
  );
  if (missing.length > 0) {
    return {
      status: "error",
      message: `Para o edital faltam nome, estado civil ou cidade do domicílio do ${[...new Set(missing)].join(" e do ")}.`,
    };
  }
  const on = today();
  const { title, body } = editalForSite(ok.tenant, {
    values: found.values,
    number: found.number,
  });
  const parsed = publicationFormSchema(noticeSectors(ok.tenant)).safeParse({
    kind: "marriageBanns",
    title: title.slice(0, 200),
    body,
    publishAt: on,
    expireAt: defaultExpiry(MARRIAGE_BANNS_NOTICE_TYPE, on) ?? on,
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "O site desta serventia não publica proclamas. Confira as atribuições em Configurações.",
    };
  }
  try {
    const publication = await createPublication(
      ok.tenant.slug,
      parsed.data,
      ok.session.user.id,
    );
    await habilitacoes.markEdital(
      ok.tenant.slug,
      id,
      publication.id,
      on,
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "rcpn.habilitacao.edital");
  }
  revalidatePath(path(id));
  revalidatePath("/admin/publicacoes");
  revalidatePath("/");
  notifyIndexNow(ok.tenant, await getSiteOrigin(), ["/editais"]);
  redirect(`${path(id)}?edital=1`);
}

export async function cancelHabilitacaoAction(
  _previous: HabilitacaoState,
  formData: FormData,
): Promise<HabilitacaoState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  try {
    await habilitacoes.cancel(
      ok.tenant.slug,
      id,
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "rcpn.habilitacao.cancel");
  }
  revalidatePath(path(id));
  redirect(path(id));
}

export async function restoreHabilitacaoAction(
  _previous: HabilitacaoState,
  formData: FormData,
): Promise<HabilitacaoState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const id = text(formData, "id");
  try {
    await habilitacoes.restore(
      ok.tenant.slug,
      id,
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "rcpn.habilitacao.restore");
  }
  revalidatePath(path(id));
  redirect(`${path(id)}?estornado=1`);
}

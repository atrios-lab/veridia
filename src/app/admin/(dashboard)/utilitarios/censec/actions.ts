"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { can } from "@/core/auth/roles.ts";
import {
  actProblems,
  CENTRALS,
  type Central,
  isQuinzena,
  quinzenaOf,
} from "@/core/censec/censec.ts";
import { actFromForm } from "@/core/censec/form.ts";
import { transferProblems } from "@/core/titularidade/titularidade.ts";
import { db } from "@/db/index.ts";
import { askApproval } from "@/lib/approval.ts";
import { currentJustification, justify } from "@/lib/audit-reason.ts";
import {
  CensecError,
  createCensecActWith,
  recordClosingWith,
  removeCensecActWith,
  removeClosingWith,
  updateCensecActWith,
} from "@/lib/censec.ts";
import { readCensecFiles } from "@/lib/censec-reading.ts";
import { getSession } from "@/lib/session.ts";
import { getTenant } from "@/lib/tenant.ts";
import { createTransferWith } from "@/lib/title-transfers.ts";
import { readTitleText } from "@/lib/titularidade-reading.ts";

export type CensecState =
  | { status: "idle" }
  | { status: "error"; message: string };

export interface UploadReport {
  files: { name: string; pages: number; acts: number; note: string }[];
  saved: {
    id: string;
    central: Central;
    title: string;
    where: string;
    quinzena: string;
    problems: string[];
    found: string[];
    sourceName: string;
  }[];
  /** Acts also launched in the communication to the prefeitura (CTP/DOI). */
  transfers: { sourceName: string; note: string }[];
}

export type UploadState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; report: UploadReport };

const NO_PERMISSION =
  "Você não tem permissão para as cargas da CENSEC. Peça ao Tabelião em Perfis e permissões.";
const GENERIC = "Não foi possível salvar agora. Tente de novo em instantes.";
const BASE = "/admin/utilitarios/censec";

/** After a fechamento: the quinzena, or the Carga CTP's month. */
function afterClosing(
  formData: FormData,
  quinzena: string,
  extra = "",
): string {
  const tail = extra ? `&${extra}` : "";
  if (formData.get("voltar") === "ctp") {
    return `${BASE}/ctp?mes=${quinzena.slice(0, 7)}${tail}`;
  }
  const back = String(formData.get("voltarq") ?? "");
  return `${BASE}?q=${isQuinzena(back) ? back : quinzena}${tail}`;
}

async function access() {
  const session = await getSession();
  if (
    !session ||
    !can(session.user.role ?? "", "censec.manage", session.user.permissions)
  ) {
    return undefined;
  }
  return { session, tenant: await getTenant() };
}

function failure(error: unknown, where: string): CensecState {
  if (error instanceof CensecError) {
    return { status: "error", message: error.message };
  }
  console.error(where, error);
  return { status: "error", message: GENERIC };
}

const formOf = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()]
      .filter(([, v]) => typeof v === "string")
      .map(([k, v]) => [k, String(v)]),
  );

/** The operations of a CEP escritura or a CESDI act that move an imóvel. */
const MOVES_PROPERTY = new Set([
  "CompraEVenda",
  "Doacao",
  "PromessaDeCompraEVenda",
  "Cessao",
  "CessaoDeDireitosHereditarios",
  "ConfissaoDeDividaOuDacaoEmPagamento",
  "SociedadeEFundacoes",
  "Divisao",
  "Inventario",
  "InventarioComMenorOuIncapaz",
  "Partilha",
  "Sobrepartilha",
  "DivorcioDireto",
  "ConversaoDeSeparacaoEmDivorcio",
  "Separacao",
]);

/**
 * Reads every document attached (or the single PDF with all of them),
 * launches each act in its central and quinzena and reports how many there
 * were and how many were launched. The files are not kept. When asked,
 * the acts that transferred an imóvel go also to the communication to the
 * prefeitura and the DOI (decision of 14/11/2026: "já vai aproveitando
 * informações de outros").
 */
export async function uploadAction(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const files = formData
    .getAll("documentos")
    .filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) {
    return {
      status: "error",
      message:
        "Escolha os documentos (escrituras, procurações, atas, testamentos).",
    };
  }
  const fallback = String(formData.get("quinzena") ?? "");
  const reuse = formData.get("aproveitar") === "sim";
  const titularidade = can(
    ok.session.user.role ?? "",
    "titularidade.manage",
    ok.session.user.permissions,
  );
  const { acts, reports } = await readCensecFiles(files);
  const report: UploadReport = { files: reports, saved: [], transfers: [] };
  try {
    for (const read of acts) {
      let quinzena = quinzenaOf(read.act.date);
      if (!quinzena && isQuinzena(fallback)) quinzena = fallback;
      if (!quinzena) {
        report.files.push({
          name: read.sourceName,
          pages: 0,
          acts: 0,
          note: `um ato (${read.found.join(", ") || "sem dados"}) ficou sem data: escolha a quinzena no envio ou lance à mão.`,
        });
        continue;
      }
      const id = await createCensecActWith(
        db,
        ok.tenant.slug,
        read.act,
        read.sourceName,
        ok.session.user.id,
        quinzena,
      );
      report.saved.push({
        id,
        central: read.act.central,
        title: `${CENTRALS[read.act.central].short}`,
        where: [
          read.act.book && `Livro ${read.act.book}${read.act.bookSuffix}`,
          read.act.page && `fls. ${read.act.page}${read.act.pageSuffix}`,
        ]
          .filter(Boolean)
          .join(", "),
        quinzena,
        problems: actProblems(read.act),
        found: read.found,
        sourceName: read.sourceName,
      });
      const moves =
        MOVES_PROPERTY.has(read.act.nature) ||
        MOVES_PROPERTY.has(read.act.kind);
      if (
        reuse &&
        titularidade &&
        moves &&
        /matr[íi]cula|im[óo]vel/i.test(read.text)
      ) {
        const title = readTitleText(read.text, read.sourceName, "notas");
        const problems = transferProblems(title.transfer);
        if (problems.length > 0) {
          report.transfers.push({
            sourceName: read.sourceName,
            note: `não entrou na titularidade: ${problems.join(" ")} Lance em Titularidade à prefeitura.`,
          });
          continue;
        }
        await createTransferWith(
          db,
          ok.tenant.slug,
          title.transfer,
          read.sourceName,
          ok.session.user.id,
        );
        report.transfers.push({
          sourceName: read.sourceName,
          note: "também lançado na comunicação à prefeitura (CTP) e na DOI.",
        });
      }
    }
  } catch (error) {
    const failed = failure(error, "censec.upload");
    return failed.status === "error"
      ? failed
      : { status: "error", message: GENERIC };
  }
  revalidatePath(BASE);
  return { status: "done", report };
}

/** A new act typed by hand, or a correction (with the justification). */
export async function saveActAction(
  _previous: CensecState,
  formData: FormData,
): Promise<CensecState> {
  const id = String(formData.get("id") ?? "");
  if (id) {
    const why = justify(formData);
    if (why) return { status: "error", message: why };
  }
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const { act, problems } = actFromForm(formOf(formData));
  if (problems.length > 0)
    return { status: "error", message: problems.join(" ") };
  const fallback = String(formData.get("quinzena") ?? "");
  let quinzena = "";
  try {
    if (id) {
      quinzena = await updateCensecActWith(
        db,
        ok.tenant.slug,
        id,
        act,
        ok.session.user.id,
        currentJustification() ?? "",
      );
    } else {
      await createCensecActWith(
        db,
        ok.tenant.slug,
        act,
        "",
        ok.session.user.id,
        fallback,
      );
      quinzena = quinzenaOf(act.date) || fallback;
    }
  } catch (error) {
    return failure(error, "censec.save");
  }
  revalidatePath(BASE);
  redirect(`${BASE}?q=${quinzena}&salvo=1`);
}

export async function removeActAction(
  _previous: CensecState,
  formData: FormData,
): Promise<CensecState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const asked = await askApproval(
    "censec.act",
    formData,
    "Ato da carga CENSEC",
  );
  if (asked) return asked;
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  let quinzena = "";
  try {
    quinzena = await removeCensecActWith(
      db,
      ok.tenant.slug,
      String(formData.get("id") ?? ""),
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "censec.remove");
  }
  revalidatePath(BASE);
  redirect(`${BASE}?q=${quinzena}`);
}

/** The fechamento done in the CENSEC, positive or negative. */
export async function closingAction(
  _previous: CensecState,
  formData: FormData,
): Promise<CensecState> {
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const quinzena = String(formData.get("quinzena") ?? "");
  try {
    await recordClosingWith(
      db,
      ok.tenant.slug,
      {
        quinzena,
        central: String(formData.get("central") ?? ""),
        acts: Number(formData.get("acts") ?? 0),
        sentOn: String(formData.get("sentOn") ?? ""),
        protocol: String(formData.get("protocol") ?? ""),
      },
      ok.session.user.id,
    );
  } catch (error) {
    return failure(error, "censec.closing");
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/ctp`);
  redirect(afterClosing(formData, quinzena, "fechado=1"));
}

export async function removeClosingAction(
  _previous: CensecState,
  formData: FormData,
): Promise<CensecState> {
  const why = justify(formData);
  if (why) return { status: "error", message: why };
  const asked = await askApproval(
    "censec.closing",
    formData,
    "Fechamento da carga CENSEC",
  );
  if (asked) return asked;
  const ok = await access();
  if (!ok) return { status: "error", message: NO_PERMISSION };
  const quinzena = String(formData.get("quinzena") ?? "");
  try {
    await removeClosingWith(
      db,
      ok.tenant.slug,
      String(formData.get("id") ?? ""),
      ok.session.user.id,
      currentJustification() ?? "",
    );
  } catch (error) {
    return failure(error, "censec.closing-remove");
  }
  revalidatePath(BASE);
  revalidatePath(`${BASE}/ctp`);
  redirect(afterClosing(formData, quinzena));
}

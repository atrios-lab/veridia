import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { test } from "node:test";

/**
 * Every PDF the panel generates offers "Assinar digitalmente" next to its
 * print link (decision of 11/11/2026), through `signHref` / `SignOrPrint`
 * (src/app/admin/_components/sign-or-print.tsx). A new PDF route has to be
 * placed in one of these two lists: this test fails until it is, so the
 * choice is made on purpose and never forgotten.
 */
const OFFERS_DIGITAL_SIGNATURE = new Set([
  "(dashboard)/agenda/comparecimento/[id]",
  "(dashboard)/agenda/comprovante/[id]",
  "(dashboard)/utilitarios/guias/[id]/arquivo",
  "(dashboard)/utilitarios/guias/ano/[ano]",
  "(dashboard)/utilitarios/iss/[id]/arquivo",
  "(dashboard)/utilitarios/papel-seguranca/oficios/[id]/arquivo",
  "(dashboard)/utilitarios/solicitacao-papeis/[id]/arquivo",
  "(dashboard)/utilitarios/livro-diario/paginas/[id]/arquivo",
  "(dashboard)/utilitarios/livro-diario/paginas/[id]/oficio",
  "(dashboard)/utilitarios/livro-diario/justica-aberta/arquivo",
  "(dashboard)/utilitarios/livro-diario/excedente/[id]/arquivo",
  // Signed on its own screen (Auditoria › notificação › assinar).
  "(dashboard)/auditoria/notificacao/[id]/pdf",
]);

/** Not a document the office signs, and why. */
const NOT_SIGNED_BY_THE_OFFICE: Record<string, string> = {
  "(dashboard)/utilitarios/assinador/[id]/arquivo": "já é o PDF assinado",
  "(dashboard)/utilitarios/assinador/[id]/manifesto":
    "manifesto de um documento já assinado",
  "(dashboard)/pedidos/[protocolo]/imprimir":
    "requerimento e declaração: quem assina é o cliente",
  "(dashboard)/auditoria/relatorio":
    "relatório gerado na hora de uma seleção, para leitura",
  "(dashboard)/ajuda/[curso]/apostila": "material de treinamento",
  "(dashboard)/ajuda/[curso]/certificado": "certificado de curso",
  "(dashboard)/publicacoes/[id]/arquivo": "arquivo enviado, não gerado",
  "(dashboard)/transparencia/documento": "arquivo enviado, não gerado",
  "(dashboard)/adequacao/anexo": "arquivo enviado, não gerado",
  "(dashboard)/mensagens/arquivo/[id]": "arquivo do chat, não gerado",
  "(dashboard)/utilitarios/iss/lei": "lei municipal anexada, não gerada",
  "(dashboard)/utilitarios/livro-diario/lancamento/[id]/comprovante":
    "comprovante de despesa anexado, não gerado",
  "(dashboard)/utilitarios/papel-seguranca/lotes/[id]/nota":
    "nota fiscal anexada, não gerada",
};

const ROOT = new URL(".", import.meta.url).pathname;

function routes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routes(path);
    return name === "route.ts" ? [path] : [];
  });
}

const servesPdf = (source: string) =>
  /application\/pdf|pdfResponse\(|renderDocuments?\(|renderGuidePdf|renderManifestPdf/.test(
    source,
  );

test("todo PDF do painel oferece assinar digitalmente, ou diz por que não", () => {
  const unplaced: string[] = [];
  for (const file of routes(ROOT)) {
    if (!servesPdf(readFileSync(file, "utf8"))) continue;
    const route = relative(ROOT, file).replace(/\/route\.ts$/, "");
    if (
      !OFFERS_DIGITAL_SIGNATURE.has(route) &&
      !(route in NOT_SIGNED_BY_THE_OFFICE)
    ) {
      unplaced.push(route);
    }
  }
  assert.deepEqual(
    unplaced,
    [],
    "Rota nova que gera PDF: ofereça 'Assinar digitalmente' (signHref) e ponha em OFFERS_DIGITAL_SIGNATURE, ou explique em NOT_SIGNED_BY_THE_OFFICE.",
  );
});

test("assinado digitalmente, o PDF sai sem a linha de assinatura à mão", () => {
  // "Assinar digitalmente" asks for `?assinatura=digital`; each route of the
  // list answers it through `renderingFor` (src/lib/pdf.ts).
  const missing = [...OFFERS_DIGITAL_SIGNATURE].filter(
    (route) =>
      !readFileSync(join(ROOT, route, "route.ts"), "utf8").includes(
        "renderingFor(",
      ),
  );
  assert.deepEqual(
    missing,
    [],
    "Rota que oferece assinatura digital: responda por renderingFor(request, ...) para tirar a linha de assinatura na versão digital.",
  );
});

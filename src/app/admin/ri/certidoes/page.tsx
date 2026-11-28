import { CERTIDAO_LABELS, CERTIDAO_RULES } from "@/core/ri/certidao.ts";
import { defaultCustasNote } from "@/core/ri/closing-notes.ts";
import { loadAcervo } from "@/lib/ri.ts";
import { CustasNoteField } from "../../_components/custas-note.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { NativeSelect } from "../../_ui/native-select.tsx";
import { Panel, RiPage } from "../_components/page.tsx";
import { requireRi } from "../_lib.ts";

export const metadata = { title: "Certidões" };

const field = "flex flex-col gap-1 text-sm font-medium";
const input =
  "h-9 rounded-md border bg-background px-3 text-sm font-normal shadow-xs";

/**
 * The certidões of the RI (Lei nº 6.015/1973, art. 19), each with its
 * selo (number and image) chosen at emission, in PDF or Word.
 */
export default async function CertidoesPage({
  searchParams,
}: {
  searchParams: Promise<{ matricula?: string; tipo?: string }>;
}) {
  const { tenant } = await requireRi();
  const params = await searchParams;
  const acervo = await loadAcervo(tenant.slug);
  const properties = acervo.properties
    .filter((p) => p.book === 2 || p.book === 3)
    .sort((a, b) => a.book - b.book || a.number - b.number);
  return (
    <RiPage
      title="Certidões"
      back={{ href: "/admin/ri", label: "Mesa do RI" }}
      description="Escolha o tipo, a matrícula e o selo. O PDF sai pronto; o Word sai para ajustar, se o cartório quiser colar o selo ou mudar o texto."
    >
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Panel title="Emitir">
          <form
            action="/admin/ri/certidoes/emitir"
            method="post"
            encType="multipart/form-data"
            target="_blank"
            className="flex flex-col gap-4"
            rel="noopener"
          >
            <label className={field} htmlFor="cert-tipo">
              Tipo de certidão
              <NativeSelect
                id="cert-tipo"
                name="tipo"
                defaultValue={params.tipo ?? "inteiro-teor"}
              >
                {Object.entries(CERTIDAO_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className={field} htmlFor="cert-matricula">
              Matrícula (não precisa na negativa)
              <NativeSelect
                id="cert-matricula"
                name="matricula"
                defaultValue={params.matricula ?? ""}
              >
                <option value="">Escolha</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.book === 3 ? "Livro 3, registro" : "Matrícula"} nº{" "}
                    {String(p.number).padStart(3, "0")}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className={field}>
              Quem pediu (opcional; em branco sai &quot;a pedido verbal da parte
              interessada&quot;)
              <input name="requerente" className={input} maxLength={200} />
            </label>
            <label className={field}>
              Quesitos (só na certidão por quesitos: um por linha)
              <textarea
                name="quesitos"
                rows={4}
                maxLength={5000}
                placeholder={
                  "Quem é o proprietário atual?\nExiste hipoteca em vigor?"
                }
                className="rounded-md border bg-background px-3 py-2 text-sm font-normal shadow-xs"
              />
              <span className="text-xs font-normal text-muted-foreground">
                O sistema responde com o que consta na matrícula. Confira antes
                de assinar.
              </span>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                Negativa: nome pesquisado
                <input name="nome" className={input} maxLength={200} />
              </label>
              <label className={field}>
                Negativa: CPF ou CNPJ
                <input name="documento" className={input} maxLength={20} />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                Número do selo
                <input name="seloNumero" className={input} maxLength={100} />
              </label>
              <label className={field}>
                Imagem do selo (opcional)
                <input
                  name="seloImagem"
                  type="file"
                  accept="image/png,image/jpeg"
                  className="text-xs font-normal"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field} htmlFor="cert-formato">
                Formato
                <NativeSelect
                  id="cert-formato"
                  name="formato"
                  defaultValue="pdf"
                >
                  <option value="pdf">PDF pronto</option>
                  <option value="word">Word, para editar</option>
                </NativeSelect>
              </label>
              <label className={field} htmlFor="cert-assinatura">
                Assinatura
                <NativeSelect
                  id="cert-assinatura"
                  name="assinatura"
                  defaultValue=""
                >
                  <option value="">Assinar à mão (linha em branco)</option>
                  <option value="imagem">
                    Com a imagem da minha assinatura
                  </option>
                </NativeSelect>
              </label>
            </div>
            <CustasNoteField
              defaultText={defaultCustasNote(tenant.location.state)}
            />
            <div>
              <button type="submit" className={buttonVariants()}>
                Emitir a certidão
              </button>{" "}
              <button
                type="submit"
                formAction="/admin/ri/certidoes/emitir?assinatura=digital"
                className={buttonVariants({ variant: "outline" })}
              >
                PDF para assinar com certificado digital
              </button>
            </div>
          </form>
        </Panel>
        <Panel title="Qual certidão usar">
          <ul className="flex flex-col gap-3 text-sm">
            {Object.entries(CERTIDAO_LABELS).map(([k, v]) => (
              <li key={k}>
                <p className="font-semibold">{v}</p>
                <p className="text-xs text-muted-foreground">
                  {CERTIDAO_RULES[k as keyof typeof CERTIDAO_RULES]}
                </p>
              </li>
            ))}
            <li className="text-xs text-muted-foreground">
              Prazos de entrega (art. 19, § 10): 4 horas para a de inteiro teor
              digital, 1 dia para a de ônus e 5 dias para as demais.
            </li>
          </ul>
        </Panel>
      </div>
    </RiPage>
  );
}

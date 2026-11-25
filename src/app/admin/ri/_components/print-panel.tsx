import { FileImage, Lock, PenLine, Printer } from "lucide-react";
import Link from "next/link";
import { signHref } from "../../_components/sign-or-print.tsx";
import { buttonVariants } from "../../_ui/button.tsx";
import { Panel } from "./page.tsx";

/**
 * The ficha out of the system (decision of 25/11/2026): printed to sign by
 * hand, with the signer's image, signed digitally, or as the ONR's
 * black-and-white image.
 */
export function PrintPanel({
  propertyId,
  title,
  signer,
  hasImage,
}: {
  propertyId: string;
  title: string;
  signer: { name: string; title: string } | null;
  hasImage: boolean;
}) {
  const pdf = `/admin/ri/matriculas/${propertyId}/ficha`;
  const button = buttonVariants({ size: "sm", variant: "outline" });
  return (
    <Panel
      title="Imprimir, assinar e imagem"
      description={
        signer
          ? `Assina: ${signer.name}, ${signer.title}.`
          : "Escolha quem assina em Configurações do RI."
      }
    >
      <div className="flex flex-col gap-2">
        <a
          href={signHref(pdf, `Ficha da ${title}`)}
          className={buttonVariants({ size: "sm" })}
        >
          <Lock className="size-4" /> Assinar digitalmente (A1 ou A3)
        </a>
        <a href={pdf} target="_blank" rel="noreferrer" className={button}>
          <Printer className="size-4" /> Imprimir para assinar à mão
        </a>
        {hasImage ? (
          <a
            href={`${pdf}?assinatura=imagem`}
            target="_blank"
            rel="noreferrer"
            className={button}
          >
            <PenLine className="size-4" /> PDF com a minha assinatura
          </a>
        ) : (
          <Link href="/admin/ri/configuracoes#assinatura" className={button}>
            <PenLine className="size-4" /> Cadastrar a imagem da assinatura
          </Link>
        )}
        <a
          href={`/admin/ri/matriculas/${propertyId}/imagem`}
          className={button}
        >
          <FileImage className="size-4" /> Imagem TIFF para a ONR
        </a>
        {hasImage && (
          <a
            href={`/admin/ri/matriculas/${propertyId}/imagem?assinatura=imagem`}
            className={button}
          >
            <FileImage className="size-4" /> TIFF com a minha assinatura
          </a>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        A imagem da assinatura não substitui a assinatura. O ato vale assinado à
        mão no papel ou digitalmente com certificado ICP-Brasil (Lei nº
        6.015/1973, art. 17, § 1º; Lei nº 14.063/2020, art. 4º). Use a imagem na
        via impressa que você vai rubricar ou na cópia de consulta.
      </p>
    </Panel>
  );
}

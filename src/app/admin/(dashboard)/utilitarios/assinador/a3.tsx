"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The Assinador Veridia on the office's computer (tools/assinador-local):
 * it lists the A3 certificates Windows knows (tokens and cards, including
 * one plugged in later) and signs with the token, which asks for the PIN.
 * Only the computer itself answers on this address.
 */
const LOCAL = "http://127.0.0.1:47820";
export const DOWNLOAD_HREF = "/downloads/AssinadorVeridia.exe";

export interface TokenCertificate {
  id: string;
  nome: string;
  emissor: string;
  validade: string;
  certificado: string;
  cadeia: string[];
}

type LocalState =
  | { kind: "procurando" }
  | { kind: "ausente" }
  | { kind: "negado"; message: string }
  | { kind: "pronto"; versao: string; certificados: TokenCertificate[] };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${LOCAL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    erro?: string;
  };
  if (!response.ok) {
    throw new Error(body.erro || `Assinador respondeu ${response.status}.`);
  }
  return body;
}

/** "MARIA EXEMPLO DA SILVA:52998224725" as the person reads it. */
export function certificateLabel(certificate: TokenCertificate): string {
  const [name, document] = certificate.nome.split(":");
  const until = new Date(certificate.validade).toLocaleDateString("pt-BR");
  const masked =
    document?.length === 11
      ? ` · CPF ***.${document.slice(3, 6)}.${document.slice(6, 9)}-**`
      : document?.length === 14
        ? ` · CNPJ ${document.slice(0, 2)}.${document.slice(2, 5)}.${document.slice(5, 8)}/${document.slice(8, 12)}-${document.slice(12)}`
        : "";
  return `${name}${masked} · válido até ${until}`;
}

export function useLocalSigner(enabled: boolean) {
  const [state, setState] = useState<LocalState>({ kind: "procurando" });
  const [chosen, setChosen] = useState("");

  const refresh = useCallback(async () => {
    setState({ kind: "procurando" });
    try {
      const status = await call<{ versao: string }>("/v1/status");
      try {
        const { certificados } = await call<{
          certificados: TokenCertificate[];
        }>("/v1/certificados");
        setState({ kind: "pronto", versao: status.versao, certificados });
        setChosen((current) =>
          certificados.some((c) => c.id === current)
            ? current
            : (certificados[0]?.id ?? ""),
        );
      } catch (error) {
        setState({ kind: "negado", message: (error as Error).message });
      }
    } catch {
      setState({ kind: "ausente" });
    }
  }, []);

  useEffect(() => {
    if (enabled) void refresh();
  }, [enabled, refresh]);

  const certificate =
    state.kind === "pronto"
      ? state.certificados.find((c) => c.id === chosen)
      : undefined;
  return { state, refresh, chosen, setChosen, certificate };
}

/** Signs on the token what the platform prepared (base64 in, base64 out). */
export async function signOnToken(
  certificate: TokenCertificate,
  toBeSigned: string,
): Promise<string> {
  const { assinatura } = await call<{ assinatura: string }>("/v1/assinar", {
    method: "POST",
    body: JSON.stringify({ id: certificate.id, dados: toBeSigned }),
  });
  return assinatura;
}

/** The certificate fields every A3 step sends to the platform. */
export function certificateFields(
  data: FormData,
  certificate: TokenCertificate,
): FormData {
  data.set("holder", certificate.certificado);
  data.set("chain", JSON.stringify(certificate.cadeia));
  return data;
}

const LABEL = "mb-1.5 block text-xs font-bold text-admin-primary";

export function LocalSignerPicker({
  signer,
  prefix,
}: {
  signer: ReturnType<typeof useLocalSigner>;
  prefix: string;
}) {
  const { state, refresh, chosen, setChosen } = signer;
  if (state.kind === "procurando") {
    return (
      <p className="text-[12.5px] text-admin-muted md:col-span-2">
        Procurando o Assinador Veridia neste computador...
      </p>
    );
  }
  if (state.kind === "ausente") {
    return (
      <div className="rounded-[12px] border border-admin-warning-soft-border bg-admin-warning-bg px-4 py-3 text-[12.5px] text-admin-warning-text md:col-span-2">
        <p className="font-semibold">
          Para assinar com token ou cartão, instale o Assinador Veridia neste
          computador (Windows). É uma vez só.
        </p>
        <ol className="mt-1.5 list-decimal space-y-0.5 pl-5">
          <li>Baixe o programa e abra o arquivo.</li>
          <li>
            Se o Windows avisar &quot;O Windows protegeu o computador&quot;,
            clique em &quot;Mais informações&quot; e depois em &quot;Executar
            assim mesmo&quot;.
          </li>
          <li>
            Deixe o token ou cartão conectado, com o driver do fabricante
            instalado.
          </li>
          <li>Volte aqui e clique em &quot;Já instalei&quot;.</li>
        </ol>
        <div className="mt-2.5 flex flex-wrap gap-2">
          <a
            href={DOWNLOAD_HREF}
            download
            className="btn btn-admin-primary btn-sm"
          >
            Baixar o Assinador Veridia
          </a>
          <button
            type="button"
            onClick={() => void refresh()}
            className="btn btn-admin-secondary btn-sm"
          >
            Já instalei, procurar de novo
          </button>
        </div>
        <p className="mt-2 text-[11.5px]">
          Se o navegador perguntar se este site pode acessar dispositivos da
          rede local, responda Permitir.
        </p>
      </div>
    );
  }
  if (state.kind === "negado") {
    return (
      <div className="rounded-[12px] border border-admin-error-border bg-admin-error-bg px-4 py-3 text-[12.5px] text-admin-error-text md:col-span-2">
        <p className="font-semibold">{state.message}</p>
        <p className="mt-1">
          Na janela do Assinador Veridia, responda Sim para este site. Se você
          respondeu Não, feche e abra o Assinador de novo (ele está no menu
          Iniciar como AssinadorVeridia).
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="btn btn-admin-secondary btn-sm mt-2"
        >
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!state.certificados.length) {
    return (
      <div className="rounded-[12px] border border-admin-border px-4 py-3 text-[12.5px] text-admin-text md:col-span-2">
        <p className="font-semibold text-admin-primary">
          Nenhum certificado A3 encontrado neste computador.
        </p>
        <p className="mt-1 text-admin-muted">
          Conecte o token ou insira o cartão. Se for a primeira vez, instale o
          driver do fabricante (ele vem com o certificado) e aguarde alguns
          segundos.
        </p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="btn btn-admin-secondary btn-sm mt-2"
        >
          Procurar de novo
        </button>
      </div>
    );
  }
  return (
    <div className="md:col-span-2">
      <label htmlFor={`${prefix}-token`} className={LABEL}>
        Certificado A3 (token ou cartão)
      </label>
      <div className="flex flex-wrap gap-2">
        <select
          id={`${prefix}-token`}
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          className="min-w-0 flex-1 rounded-[9px] border border-admin-input-border bg-admin-input-bg px-3 py-2 text-[13px] text-admin-text outline-none focus:border-admin-primary-soft"
        >
          {state.certificados.map((certificate) => (
            <option key={certificate.id} value={certificate.id}>
              {certificateLabel(certificate)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void refresh()}
          className="btn btn-admin-secondary btn-sm"
          title="Conectou outro token? Atualize a lista."
        >
          Atualizar lista
        </button>
      </div>
      <p className="mt-1 text-[11.5px] text-admin-muted">
        O PIN é pedido pela janela do próprio token. A chave nunca sai dele.
      </p>
    </div>
  );
}

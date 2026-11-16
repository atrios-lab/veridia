"use client";

import { useCallback, useEffect, useState } from "react";
import { describeGrant, type StationGrant } from "@/core/signature/station.ts";
import { Button, buttonVariants } from "../../../_ui/button.tsx";
import {
  NativeSelect,
  NativeSelectOption,
} from "../../../_ui/native-select.tsx";
import {
  requestStationSignatureAction,
  sharedCertificatesAction,
  stationSignatureStatusAction,
} from "./station-sign-actions.ts";

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
  /**
   * A token plugged into another computer of the office, shared through
   * its signing station (decision of 16/11/2026): signed there, not here.
   */
  estacao?: {
    id: string;
    nome: string;
    online: boolean;
    modo: "periodo" | "cada";
    liberadoAte: string | null;
    /** What this person may sign with it, and when. */
    autorizacao?: StationGrant;
  };
}

/** The id a shared certificate takes in the list (never a local one's). */
const sharedId = (c: { id: string; estacao?: { id: string } }) =>
  c.estacao ? `estacao:${c.estacao.id}:${c.id}` : c.id;

type LocalState =
  | { kind: "procurando" }
  | { kind: "ausente" }
  | { kind: "negado"; message: string }
  | {
      kind: "pronto";
      versao: string;
      certificados: TokenCertificate[];
      /** The Assinador answered on this computer (else only shared ones). */
      local: boolean;
    };

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
    // The tokens shared with this person through the office's stations,
    // looked up at the same time as this computer's own.
    const sharedPromise = sharedCertificatesAction()
      .then((list) =>
        list.map((c): TokenCertificate => ({ ...c, id: sharedId(c) })),
      )
      .catch((): TokenCertificate[] => []);
    const pick = (certificados: TokenCertificate[]) =>
      setChosen((current) =>
        certificados.some((c) => c.id === current)
          ? current
          : (certificados.find((c) => !c.estacao)?.id ??
            certificados[0]?.id ??
            ""),
      );
    try {
      const status = await call<{ versao: string }>("/v1/status");
      try {
        const { certificados } = await call<{
          certificados: TokenCertificate[];
        }>("/v1/certificados");
        // The station's own computer: its token is here already.
        const all = [
          ...certificados,
          ...(await sharedPromise).filter(
            (shared) =>
              !certificados.some(
                (local) => local.id === shared.id.split(":").at(-1),
              ),
          ),
        ];
        setState({
          kind: "pronto",
          versao: status.versao,
          certificados: all,
          local: true,
        });
        pick(all);
      } catch (error) {
        const shared = await sharedPromise;
        if (shared.length) {
          setState({
            kind: "pronto",
            versao: "",
            certificados: shared,
            local: false,
          });
          pick(shared);
        } else {
          setState({ kind: "negado", message: (error as Error).message });
        }
      }
    } catch {
      const shared = await sharedPromise;
      if (shared.length) {
        setState({
          kind: "pronto",
          versao: "",
          certificados: shared,
          local: false,
        });
        pick(shared);
      } else {
        setState({ kind: "ausente" });
      }
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

const wait = (ms: number) => new Promise((done) => setTimeout(done, ms));

/**
 * A shared token signs at its station: the request goes to the platform,
 * the station picks it up, signs and answers; this waits for the answer.
 */
async function signAtStation(
  certificate: TokenCertificate & {
    estacao: NonNullable<TokenCertificate["estacao"]>;
  },
  toBeSigned: string,
  title: string,
): Promise<{ signature: string; jobId: string }> {
  const asked = await requestStationSignatureAction({
    stationId: certificate.estacao.id,
    certificateKey: certificate.id.split(":").at(-1) ?? "",
    toBeSigned,
    title,
  });
  if (asked.status === "error") throw new Error(asked.message);
  // The station calls in every few seconds; "cada" waits for a person there.
  for (let i = 0; i < 140; i += 1) {
    await wait(1500);
    const status = await stationSignatureStatusAction(asked.id);
    if (status.status === "assinada") {
      return { signature: status.signature, jobId: asked.id };
    }
    if (status.status === "falhou") throw new Error(status.message);
  }
  throw new Error("A estação não respondeu a tempo.");
}

/**
 * Signs on the token what the platform prepared (base64 in, base64 out);
 * through a station, also the id of the request, for its record.
 */
export async function signOnTokenWithJob(
  certificate: TokenCertificate,
  toBeSigned: string,
  title = typeof document === "undefined" ? "Documento" : document.title,
): Promise<{ signature: string; jobId?: string }> {
  if (certificate.estacao) {
    return signAtStation(
      { ...certificate, estacao: certificate.estacao },
      toBeSigned,
      title || "Documento",
    );
  }
  const { assinatura } = await call<{ assinatura: string }>("/v1/assinar", {
    method: "POST",
    body: JSON.stringify({ id: certificate.id, dados: toBeSigned }),
  });
  return { signature: assinatura };
}

/** Signs on the token what the platform prepared (base64 in, base64 out). */
export async function signOnToken(
  certificate: TokenCertificate,
  toBeSigned: string,
  title?: string,
): Promise<string> {
  return (await signOnTokenWithJob(certificate, toBeSigned, title)).signature;
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

const LABEL = "mb-1.5 block text-sm font-medium text-foreground";

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
      <p className="text-xs text-muted-foreground md:col-span-2">
        Procurando o Assinador Veridia neste computador...
      </p>
    );
  }
  if (state.kind === "ausente") {
    return (
      <div className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-xs text-warning-text md:col-span-2">
        <p className="font-medium">
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
            className={buttonVariants({ size: "sm" })}
          >
            Baixar o Assinador Veridia
          </a>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
          >
            Já instalei, procurar de novo
          </Button>
        </div>
        <p className="mt-2 text-xs">
          Se o navegador perguntar se este site pode acessar dispositivos da
          rede local, responda Permitir.
        </p>
      </div>
    );
  }
  if (state.kind === "negado") {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive-soft px-4 py-3 text-xs text-destructive md:col-span-2">
        <p className="font-medium">{state.message}</p>
        <p className="mt-1">
          Na janela do Assinador Veridia, responda Sim para este site. Se você
          respondeu Não, feche e abra o Assinador de novo (ele está no menu
          Iniciar como AssinadorVeridia).
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          className="mt-2"
        >
          Tentar de novo
        </Button>
      </div>
    );
  }
  if (!state.certificados.length) {
    return (
      <div className="rounded-lg border px-4 py-3 text-xs text-foreground md:col-span-2">
        <p className="font-medium text-foreground">
          Nenhum certificado A3 encontrado neste computador.
        </p>
        <p className="mt-1 text-muted-foreground">
          Conecte o token ou insira o cartão. Se for a primeira vez, instale o
          driver do fabricante (ele vem com o certificado) e aguarde alguns
          segundos.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void refresh()}
          className="mt-2"
        >
          Procurar de novo
        </Button>
      </div>
    );
  }
  return (
    <div className="md:col-span-2">
      <label htmlFor={`${prefix}-token`} className={LABEL}>
        Certificado A3 (token ou cartão)
      </label>
      <div className="flex flex-wrap gap-2">
        <NativeSelect
          id={`${prefix}-token`}
          value={chosen}
          onChange={(event) => setChosen(event.target.value)}
          className="min-w-0 flex-1"
        >
          {state.certificados.map((certificate) => (
            <NativeSelectOption key={certificate.id} value={certificate.id}>
              {certificate.estacao
                ? `${certificateLabel(certificate)} · compartilhado na estação ${certificate.estacao.nome}${certificate.estacao.online ? "" : " (desligada)"}`
                : certificateLabel(certificate)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          type="button"
          variant="outline"
          onClick={() => void refresh()}
          title="Conectou outro token? Atualize a lista."
        >
          Atualizar lista
        </Button>
      </div>
      <SharedNote
        certificate={state.certificados.find((c) => c.id === chosen)}
      />
      {!state.local && (
        <p className="mt-1 text-xs text-muted-foreground">
          Este computador não tem o Assinador Veridia: aparecem só os
          certificados compartilhados pelas estações do cartório.
        </p>
      )}
    </div>
  );
}

/** What signing with the chosen certificate means, in one line. */
function SharedNote({ certificate }: { certificate?: TokenCertificate }) {
  if (!certificate?.estacao) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        O PIN é pedido pela janela do próprio token. A chave nunca sai dele.
      </p>
    );
  }
  const { estacao } = certificate;
  if (!estacao.online) {
    return (
      <p className="mt-1 text-xs text-warning-text">
        A estação {estacao.nome} está desligada agora. Ligue o computador com o
        token e abra o Assinador Veridia.
      </p>
    );
  }
  if (estacao.modo === "periodo" && !estacao.liberadoAte) {
    return (
      <p className="mt-1 text-xs text-warning-text">
        O uso deste certificado não está liberado agora. Peça ao Tabelião para
        liberar em Configurações › Certificados.
      </p>
    );
  }
  return (
    <p className="mt-1 text-xs text-muted-foreground">
      {estacao.modo === "periodo"
        ? `Assinado na estação ${estacao.nome}, liberado até ${new Date(estacao.liberadoAte ?? "").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}.`
        : `Assinado na estação ${estacao.nome}: alguém lá confirma cada assinatura.`}{" "}
      A chave nunca sai do token e cada uso fica registrado.
      {estacao.autorizacao && (
        <span className="mt-0.5 block">
          Sua autorização: {describeGrant(estacao.autorizacao)}.
        </span>
      )}
    </p>
  );
}

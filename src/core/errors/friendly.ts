/**
 * What a person reads when a screen fails (decision of 14/11/2026: "sempre
 * que der algum erro que chegue a mensagem em português dizendo o que foi;
 * se o site cair, dizer que está em manutenção; se for limite, dizer que
 * está muito grande"). The error's own text is technical and in English;
 * this turns it into one of a few plain cases. The code (digest) is shown
 * so the support can find the error in the server's log.
 */

export type FriendlyKind =
  | "tamanho"
  | "tempo"
  | "conexao"
  | "manutencao"
  | "geral";

export interface FriendlyError {
  kind: FriendlyKind;
  title: string;
  explanation: string;
}

const MESSAGES: Record<FriendlyKind, Omit<FriendlyError, "kind">> = {
  tamanho: {
    title: "O envio ficou muito grande",
    explanation:
      "O arquivo ou a quantidade de dados passou do limite que o servidor aceita de uma vez. Tente enviar em partes menores (por exemplo, separando por tipo ou por período).",
  },
  tempo: {
    title: "Demorou mais que o limite do servidor",
    explanation:
      "A operação levou mais tempo do que o servidor permite, em geral por ser muito grande. Tente de novo em partes menores; se continuar, avise o suporte com o código abaixo.",
  },
  conexao: {
    title: "Sem conexão com a internet",
    explanation:
      "Não foi possível falar com o servidor. Confira a internet e tente de novo.",
  },
  manutencao: {
    title: "O site está em manutenção",
    explanation:
      "Estamos ajustando o sistema. Tente novamente em alguns minutos.",
  },
  geral: {
    title: "Algo deu errado nesta tela",
    explanation:
      "O erro foi registrado. Tente de novo; se continuar, avise o suporte com o código abaixo.",
  },
};

/**
 * The case, from the error's text. `online` is the browser's own word on
 * the connection; `whole` is true when the whole site failed (its layout),
 * which reads as maintenance whatever the text.
 */
export function friendlyError(input: {
  message?: string;
  online?: boolean;
  whole?: boolean;
}): FriendlyError {
  const text = (input.message ?? "").toLowerCase();
  let kind: FriendlyKind = "geral";
  if (input.online === false) kind = "conexao";
  else if (
    /payload too large|body exceeded|request entity|\b413\b|too large|function_payload_too_large/.test(
      text,
    )
  ) {
    kind = "tamanho";
  } else if (
    /timeout|timed out|\b504\b|function_invocation_timeout|aborted/.test(text)
  ) {
    kind = "tempo";
  } else if (/unexpected response was received from the server/.test(text)) {
    // The server answered with the hosting's own error page instead of
    // the screen: in practice, a limit of size or of time.
    kind = "tamanho";
  } else if (
    /failed to fetch|networkerror|load failed|\b50[023]\b/.test(text)
  ) {
    kind = "manutencao";
  } else if (input.whole) {
    kind = "manutencao";
  }
  return { kind, ...MESSAGES[kind] };
}

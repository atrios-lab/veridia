## Context

`/acompanhar` (`protocol-trilho.tsx`) e `/protocolo` (`protocol-lookup.tsx`) são duas telas
diferentes sobre o mesmo dado: ambas chamam `lookupProtocolDetail` e recebem o mesmo
`ServiceRequestDetail`, que já traz `statusReason` e `rejectionDocumentAttachmentId` preenchidos
pelo cartório ao indeferir/cancelar (`actions.ts:360-361`). `/protocolo` já renderiza os dois
campos corretamente em `RequestDetail` (`protocol-lookup.tsx:1123-1152`). `/acompanhar` nunca lê
esses campos: `computeHeadline`, o histórico (`buildLog`) e `RejectedCard` (todos em
`protocol-trilho.tsx`) usam texto fixo que afirma "enviamos o motivo" por mensagem — coisa que
nunca acontece — e não mostram motivo nenhum, nem orientam o cidadão a refazer o pedido.

Hoje `/acompanhar` é a via em produção (URL do print: `.../acompanhar?numero=...`), então o
conserto precisa entrar nela, não em `/protocolo`.

## Goals / Non-Goals

**Goals:**
- `/acompanhar` mostrar o motivo real do indeferimento (texto e/ou PDF), do mesmo jeito que
  `/protocolo` já mostra.
- Parar de afirmar que um motivo foi "enviado" por mensagem.
- Orientar o cidadão indeferido a refazer o pedido corretamente.

**Non-Goals:**
- Não unificar `/acompanhar` e `/protocolo` num componente só. São reescritas independentes com
  layouts diferentes (trilho vs. cartão de detalhe); a duplicação de dado já existe hoje e não é
  o problema desta mudança.
- Não adiciona envio de e-mail/notificação com o motivo.
- Não muda `lookupProtocolDetail` nem o schema de `ServiceRequestDetail` — os campos já existem.

## Decisions

- **Onde plugar o motivo — fora do card de instruções**: `RejectedCard` (`protocol-trilho.tsx`) é
  um card de alerta pequeno, pensado para instruções curtas — não para texto livre do cartório,
  que pode ser longo. Por isso o motivo vira um componente próprio,
  `RejectionReason({ result, protocolNumber, accessKey })`. Ele reaproveita a mesma estrutura
  condicional que `RequestDetail` já usa em `protocol-lookup.tsx:1129-1150` (texto quando há
  `statusReason` ou não há documento; botão de download quando há
  `rejectionDocumentAttachmentId`; fallback "Motivo não informado."), com o mesmo padrão de form
  (`action="/protocolo/documento"`) já usado por `protocol-trilho.tsx` para outros downloads —
  mesmo padrão, não endpoint novo. `RejectedCard` fica só com o título de alerta e as instruções
  curtas (refazer o pedido, canal de atendimento).
- **Layout: coluna única de largura total, alerta acima do motivo**: quando `rejected`, o conteúdo
  não usa a grade de duas colunas (`md:grid-cols-2`) que as outras telas de status usam — ela
  deixaria o motivo espremido em meia largura. Em vez disso, a área de conteúdo vira uma pilha de
  largura total: headline, `RejectedCard` (instruções), `RejectionReason` (motivo), `leadText`,
  prazo e exigências resolvidas/pendentes, nessa ordem. Isso duplica um pouco de JSX entre o ramo
  `rejected` e o ramo padrão (a grade de duas colunas, inalterada para todo o resto), mas evita
  lutar com `col-span`/`order` do CSS Grid para simular uma linha de largura total no meio de uma
  grade de duas colunas — mais simples e mais fácil de ler que a alternativa.
- **Motivo em parágrafos, justificado**: `statusReason` é texto livre digitado num `<textarea>` no
  painel — pode conter linhas em branco separando parágrafos. `RejectionReason` quebra o texto em
  `splitParagraphs` (por `\n\s*\n`) e renderiza cada parágrafo como um `<p>` próprio, com
  `text-justify`, em vez de um único bloco com `whitespace-pre-line` — garante que a formatação do
  cartório apareça como parágrafos de verdade na consulta, não como um parágrafo único.
- **Diferenciar Indeferido de Cancelado**: a orientação de "refazer o pedido" só faz sentido para
  `requestStatus === "rejected"`. `RejectedCard` deriva isso de `result.requestStatus` para decidir
  se mostra essa linha extra; `RejectionReason` não depende do status para decidir se mostra o
  motivo (indeferido e cancelado podem ambos ter `statusReason`).
- **Onde a copy muda**:
  - `computeHeadline` (linha ~260-266): `leadText` deixa de dizer "explicamos o motivo na
    mensagem que enviamos para você" e passa a ser só a orientação de contato/novo pedido ("se
    ficou alguma dúvida..."), sem mencionar o motivo — ele já apareceu acima, em `RejectionReason`,
    antes deste parágrafo.
  - `buildLog`: o `sub` do evento "Pedido não aceito."/"Pedido cancelado." deixa de ser "Enviamos
    o motivo para você." — passa a "O motivo está detalhado no início desta página.", apontando
    para o topo da página em vez de uma posição relativa que muda com o layout.
  - `RejectedCard`: substitui "Enviamos o motivo para você." pela orientação de refazer o pedido
    (só indeferido) e mantém a menção ao atendimento online/balcão para dúvidas — sem o texto do
    motivo em si.
- **Texto de orientação**: usar uma frase objetiva e corrigida do que foi pedido, algo como "Você
  pode refazer o pedido, cobrindo o que motivou o indeferimento." — o texto exato é copy, não regra
  de negócio, e pode ser ajustado na implementação sem reabrir esta proposta.

## Risks / Trade-offs

- [Duplicar a lógica de "motivo + documento" entre as duas telas] → Aceito nesta mudança (mesmo
  padrão de duplicação que já existe entre `/acompanhar` e `/protocolo` hoje); extrair um
  componente compartilhado fica como possível revisão futura, não bloqueia este conserto.
- [Texto do card ficar longo com motivo + orientação + atendimento] → Mitigar na implementação
  mantendo cada parte em um parágrafo curto, seguindo o estilo direto já usado no restante da
  página (validar visualmente no preview antes de finalizar).

## Open Questions

- Texto exato de cada string (`leadText`, `sub` do histórico, orientação de indeferimento) fica a
  cargo de quem implementa/revisa copy — não é uma decisão técnica que bloqueie o design.

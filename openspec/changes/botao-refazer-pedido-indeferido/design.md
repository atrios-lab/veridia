## Context

`RejectedCard` (`src/app/(public)/acompanhar/protocol-trilho.tsx:1407-1427`) é o card de alerta
exibido em `/acompanhar` para pedidos "Indeferido" ou "Cancelado". Ele já diferencia os dois casos
via `result.requestStatus === "rejected"` (`isRejected`): só o Indeferido ganha a linha "Você pode
refazer o pedido, cobrindo o que motivou o indeferimento." Ambos os casos hoje terminam com o mesmo
parágrafo de contato ("fale com a gente pelo atendimento online ou no balcão"), que este change
substitui — para os dois desfechos — por um botão que leva a `/solicitar`.

`/solicitar` (`src/app/(public)/solicitar/page.tsx`) é um assistente de rota única guiado por query
string (`?atribuicao=&ato=`); sem os dois parâmetros, ele abre no passo 1 (escolha de atribuição).
`ServiceRequestDetail` (retornado por `lookupProtocolDetail`, `src/app/(public)/protocolo/actions.ts`)
não carrega os slugs (`act.id`, `act.attribution`) do pedido original, só os nomes de exibição — não
há hoje como linkar direto para o mesmo ato sem estender esse tipo.

## Goals / Non-Goals

**Goals:**
- Trocar o convite a sair da plataforma por uma ação que mantém o cidadão nela: um botão "Refazer
  pedido" apontando para `/solicitar`, visível para os desfechos "Indeferido" e "Cancelado".
- Reaproveitar o padrão visual de botão já usado no arquivo (`btn btn-primary`, ver o botão de
  download em `DoneCard`, linha 1395-1400).

**Non-Goals:**
- Não pré-seleciona a atribuição/ato do pedido original — o link é genérico para `/solicitar`.
  Deep-linking para o mesmo ato fica para uma evolução futura (exigiria adicionar `actId`/
  `attribution` a `ServiceRequestDetail`).
- Não altera o `leadText` do cabeçalho da página (a frase mais genérica "se ficou alguma dúvida,
  fale com a gente...", compartilhada entre Indeferido e Cancelado) — fica fora deste change.
- Não introduz nenhuma chamada de rede nova: `/solicitar` já existe e já é navegável por link comum.

## Decisions

- **Botão como `<Link>`, não `<button onClick>`**: navegação para outra rota é link de verdade, não
  ação client-side — mesmo padrão de todo outro link para `/solicitar` no código (ex.:
  `request-form.tsx:1039-1046`, `<Link href="/solicitar" className="btn btn-secondary btn-lg">`).
  Aqui o estilo primário (`btn btn-primary`) faz sentido por ser a ação principal do card, como o
  botão de download em `DoneCard`.
- **Link genérico, sem query string**: a alternativa (deep-link para o mesmo ato via
  `?atribuicao=&ato=`) foi descartada nesta mudança porque exigiria estender
  `ServiceRequestDetail` com campos que hoje não existem (`act.id`, `act.attribution`) — mudança de
  schema fora do escopo deste ajuste de copy/UI. Fica registrado como possível change futura.
- **Botão fora da condicional `isRejected`, texto de indeferimento continua dentro dela**: a linha
  "Você pode refazer o pedido, cobrindo o que motivou o indeferimento." só faz sentido para
  Indeferido (cita "indeferimento" explicitamente) e continua dentro de `{isRejected && (...)}`. O
  botão "Refazer pedido", por ser genérico o bastante para os dois desfechos, fica fora dessa
  condicional e sempre aparece.

## Risks / Trade-offs

- [Card fica com duas ações — motivo detalhado abaixo (`RejectionReason`) e botão de refazer aqui
  em cima] → Aceito: o botão substitui um parágrafo de texto, não soma conteúdo; o card não cresce.
- [Cidadão que precisa de ajuda genuína, não relacionada a refazer o pedido, perde a menção a
  atendimento online/balcão] → Aceito nesta mudança por decisão explícita do cartório (amarrar o
  cidadão à plataforma); outros pontos de contato (rodapé, `/contato`) continuam disponíveis no
  site.
- [Cancelamento não implica pedido malfeito (ver proposta original que introduziu este card,
  `exibir-motivo-indeferimento-acompanhar`), então "refazer o pedido" pode não ser a ação certa
  para todo cancelamento] → Aceito por decisão explícita de quem pediu a mudança: o botão aparece
  para os dois desfechos.

## Open Questions

Nenhuma — escopo, texto do botão e destino já validados em conversa com quem pediu a mudança.

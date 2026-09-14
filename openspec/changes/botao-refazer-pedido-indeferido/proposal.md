## Why

No card de indeferimento da consulta pública `/acompanhar`, a orientação de contato ("fale com a
gente pelo atendimento online ou no balcão") empurra o cidadão indeferido para fora da plataforma
em vez de levá-lo direto a refazer o pedido, que é a ação que resolve o caso na maioria das vezes.
Feedback interno do cartório: a mensagem deve amarrar o cidadão à plataforma, não oferecer um
atalho para outro canal.

## What Changes

- No `RejectedCard` (`protocol-trilho.tsx`), para os desfechos "Indeferido" e "Cancelado", o
  parágrafo "Se ficou alguma dúvida, fale com a gente pelo atendimento online ou no balcão. Estamos
  aqui para ajudar." é substituído por um botão "Refazer pedido" que leva para `/solicitar`.
- O botão usa link genérico para `/solicitar` (tela inicial do assistente de pedido) — não
  pré-seleciona a atribuição/ato do pedido original.
- A linha "Você pode refazer o pedido, cobrindo o que motivou o indeferimento." continua exclusiva
  do desfecho "Indeferido" (o texto menciona indeferimento, não se aplica a cancelamento); o botão
  aparece para os dois.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: a etapa final de desfecho negativo ("Indeferido" ou "Cancelado") na consulta
  de protocolo (`/acompanhar`) passa a oferecer uma ação direta para refazer o pedido na própria
  plataforma, em vez de orientar o cidadão a buscar outro canal de atendimento.

## Não-objetivos

- Não altera o `leadText` do cabeçalho da página (a frase mais genérica "se ficou alguma dúvida,
  fale com a gente..."), que é compartilhado entre Indeferido e Cancelado — mexer nele arrastaria o
  Cancelado junto.
- Não pré-seleciona a atribuição/ato do pedido original no link de `/solicitar`. Isso exigiria
  adicionar os slugs (`act.id`, `act.attribution`) a `ServiceRequestDetail`, que hoje só carrega os
  nomes de exibição (`actName`, `attributionName`). Fica como possível evolução futura.
- Não toca a tela `/protocolo` (`protocol-lookup.tsx`).
- Não muda `lookupProtocolDetail` nem o schema de `ServiceRequestDetail`.

## Impact

- `src/app/(public)/acompanhar/protocol-trilho.tsx`: `RejectedCard` — o parágrafo de contato é
  substituído por um link/botão para `/solicitar`, para todo o componente (Indeferido e Cancelado).

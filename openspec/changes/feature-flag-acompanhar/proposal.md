## Why

A experiência `/acompanhar` (trilho de progresso, conversa de exigência em chat, Pix) já está implementada e hoje qualquer cidadão com protocolo + chave cai nela sem nenhum controle de ativação. Precisamos poder ligar e desligar essa experiência sem novo deploy — para testar em produção com tráfego real antes de torná-la a via oficial de acompanhamento e, só depois, decidir aposentar a tela de detalhe atual embutida em `/protocolo`.

## What Changes

- Introduzir uma feature flag, avaliada **no servidor**, que decide se a consulta do cidadão é servida pela experiência `/acompanhar` (trilho) ou pela tela de detalhe atual em `/protocolo`.
- Com a flag desligada, `/acompanhar` **NÃO** fica acessível como via de consulta (comportamento hoje: nenhum controle) — `/protocolo` continua sendo a única porta de entrada, como já é.
- Com a flag ligada, os pontos de entrada da consulta do cidadão (o formulário "Consultar protocolo", e qualquer link para acompanhamento que a serventia publique) passam a apontar para `/acompanhar`; `/protocolo` continua existindo e funcionando (não é removida nesta mudança).
- Adotar o **Flags SDK da Vercel** (pacote `flags`) com **Edge Config** como armazenamento, o que dá avaliação de baixíssima latência e permite ligar/desligar pelo **Vercel Toolbar** em preview e produção sem redeploy.
- A flag é global ao deploy (não por tenant) nesta primeira fase — ver Não-objetivos.

## Não-objetivos

- Não remove `/protocolo` nem sua tela de detalhe autenticada nesta mudança. A aposentadoria dela é uma decisão futura, condicionada ao resultado do rollout.
- Não introduz rollout percentual, por-tenant ou por-usuário nesta fase — o objetivo mínimo é on/off controlável sem deploy. Segmentação mais fina fica registrada em design.md como evolução possível, não como escopo desta mudança.
- Não altera nenhuma regra de negócio de prazo, exigência, pagamento ou conversa — apenas onde e por qual rota o cidadão as vê.
- Não migra `/acompanhar` para cobrir os canais de LGPD/ouvidoria além do que já foi implementado (isso já está feito em código, fora do escopo desta proposta).

## Capabilities

### New Capabilities
- `citizen-tracking-rollout`: controla, via feature flag avaliada no servidor, qual rota serve a consulta do cidadão (`/acompanhar` ou `/protocolo`); define o comportamento de fallback quando a flag está desligada, indisponível ou falha ao ser lida.

### Modified Capabilities

<!-- Nenhuma: o comportamento de prazo, exigência e conversa especificado em service-request e
     requirement-conversation não muda — apenas a rota que o exibe. -->

## Impact

- Novo pacote `flags` (Flags SDK da Vercel) como dependência de produção.
- Novo recurso de infraestrutura: um Edge Config no projeto Vercel do time, com a variável de conexão correspondente (`EDGE_CONFIG` ou equivalente) nos ambientes de preview e produção.
- Rotas afetadas: `src/app/(public)/protocolo/` (formulário e CTA de consulta), `src/app/(public)/acompanhar/` (já existe).
- `.github/workflows/verify.yml`: pode precisar de uma variável de ambiente para os testes e2e exercitarem os dois estados da flag (ligada e desligada).
- Nenhuma migração de banco.

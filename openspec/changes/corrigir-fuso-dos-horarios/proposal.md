## Why

O servidor roda em UTC e várias telas e PDFs formatam data e hora sem informar o fuso. Em produção, o painel mostra os horários do pedido 3 horas adiantados e, a partir das 21h, a data já é a do dia seguinte. Quem desenvolve em máquina no fuso do Brasil não vê o problema, por isso ele passou despercebido.

## What Changes

- Toda data e hora de um instante (pedido, histórico, anexo, exigência, comprovante) passa a sair no fuso da serventia, seja qual for o fuso do servidor ou do aparelho de quem vê.
- O fuso e os formatadores ficam em um único módulo do núcleo, no lugar das cópias locais em cada tela.
- Os PDFs do requerimento e dos comprovantes passam a trazer a data do dia em que o pedido foi feito, mesmo depois das 21h.
- O prazo de 15 dias da LGPD em destaque no painel passa a contar a partir do dia do pedido no fuso da serventia, igual às telas de LGPD.
- O ano do protocolo passa a ser o da serventia: pedido feito depois das 21h de 31/12 não recebe mais o número do ano seguinte.
- A previsão de conclusão na consulta do protocolo deixa de sair um dia antes. Hoje `/acompanhar` lê um dia de calendário como meia-noite em UTC, e o aparelho no Brasil mostra a véspera.
- O fuso da serventia passa a ser `America/Fortaleza`, porque todos os clientes são do Rio Grande do Norte. O horário continua igual ao de hoje, e o sistema não muda sozinho se o horário de verão voltar para São Paulo.
- Todo o sistema usa esse único fuso: a declaração de hipossuficiência, o horário do chat, a página de contato e o formulário de publicações deixam de ter um valor próprio.

## Não-objetivos

- Fuso por serventia. Todos os clientes são do Rio Grande do Norte, e o fuso continua sendo uma constante.
- Mudança no banco ou correção de dados: as colunas são `timestamptz` e guardam o instante certo.
- Regravação de documentos já entregues ao cidadão ou de arquivos já enviados.
- Mudança no formato das datas, além de corrigir o valor.
- Trocar o motor de datas ou adotar biblioteca nova: `Intl.DateTimeFormat` resolve.
- Alterar os scripts avulsos em `scripts/` (`backfill-deadline-pause.ts`, `pending-legacy-appointments.ts`): o horário dos dois fusos é igual hoje, e eles não rodam junto com o app.

## Capabilities

### New Capabilities

- `office-time-display`: como o sistema mostra data e hora e define o dia e o ano dos registros: sempre no fuso da serventia, sem depender do fuso do servidor ou do aparelho.

### Modified Capabilities

Nenhuma: os requisitos existentes não definem fuso, e o comportamento deles continua o mesmo.

## Impact

- **Novo módulo:** `src/core/time/office-time.ts`, com `OFFICE_TIME_ZONE` e os formatadores. `src/lib/office-config.ts` reexporta a constante, sem mudar quem já a importa.
- **Painel:** `pedidos/[protocolo]/page.tsx`, `requirements-section.tsx`, `lgpd/[protocolo]/page.tsx`, `ouvidoria/[protocolo]/page.tsx`, `transparencia/_components/document-list.tsx`, `publicacoes/_components/publication-form.tsx` e `src/lib/admin-overview.ts`.
- **Site público:** `acompanhar/protocol-trilho.tsx`, `protocolo/protocol-lookup.tsx` e `contato/page.tsx`.
- **Chat:** `src/core/chat/hours.ts`.
- **PDFs:** `src/core/request/requerimento.ts` e `src/core/request/declaracao.ts`.
- **Número de protocolo:** `src/lib/service-request.ts`, `src/lib/appointments.ts` e as actions de `solicitar`, `lgpd` e `ouvidoria`.
- **Migração:** nenhuma; não há ordem especial de deploy.

## Context

O canal LGPD já tem a mecânica completa de prazo: constante legal em `src/core/request/channels.ts` (`DATA_RIGHTS_DEADLINE_DAYS = 15`, com `dataRightsDeadline` e `dataRightsDayOfDeadline`), urgência em `src/core/overview/urgency.ts` (`dataRightsUrgency`, com `DUE_SOON_DAYS = 3`), badge no painel (`admin/(dashboard)/lgpd/_components/deadline-badge.tsx`) e contagem na consulta pública (`protocol-lookup.tsx`). O canal de pedidos (REQ) não tem nada disso, e é o canal com 18 andamentos, exigência e prazo que na prática "depende da demanda".

O pedido do cartório (Joelison) fixa três pontos de desenho que este documento apenas registra:
1. O prazo padrão segue a lei mas é editável pelo cartório.
2. O prazo é por protocolo, editável manualmente, inclusive nos lançados no balcão.
3. A cada troca de andamento o operador vê a opção de mexer no prazo — inclusive zerar, para o relógio recomeçar dali ("quando o processo é analisado, o prazo pode ser zerado... para já iniciar o prazo a partir de lá").

## Goals / Non-Goals

**Goals:**
- Prazo por pedido como par (data de início, dias corridos), com default do tenant e edição na troca de andamento.
- Cidadão vê a situação do prazo na emissão e na consulta; operador vê urgência na fila e no detalhe.
- Reusar a mecânica LGPD em vez de duplicá-la.

**Non-Goals:**
- Prazo por ato/atribuição, dias úteis, pausa automática em exigência, prazo LGPD editável, urgência na Visão geral, notificações (ver Non-goals da proposta).

## Decisions

### 1. Prazo vive no `details` do pedido, não em coluna

`serviceRequestDetailsSchema` ganha um bloco opcional:

```ts
deadline: z.object({
  startedOn: isoDate,   // dia 1 da contagem
  days: z.number().int().min(1).max(365),
}).optional()
```

- **Por quê**: zero migração; o JSONB `details` é exatamente o lugar de "campos que só um kind preenche", e todo write/read já passa pelo parse do core. Alternativa considerada: colunas `deadline_started_on`/`deadline_days` — daria índice e query SQL de vencidos, mas ninguém precisa dessa query hoje (a fila já carrega as linhas e calcula em memória, como o LGPD faz).
- **Ausente = calculado**: pedido sem `deadline` gravado conta de `createdAt` com o default do tenant. Protocolos antigos ganham prazo de graça, e a emissão não precisa gravar nada — só grava quem mexeu no prazo. Consequência aceita: mudar o default do tenant reposiciona o prazo dos pedidos que nunca foram tocados; é o comportamento honesto ("o padrão mudou") e evita um backfill.

### 2. Núcleo: generalizar, não duplicar

- `channels.ts` (ou módulo novo `deadline.ts` no core/request): `deadlineDate(startedOn, days)` e `dayOfDeadline(startedOn, today)` — a generalização direta de `dataRightsDeadline`/`dataRightsDayOfDeadline`, que passam a delegar para elas com 15 fixo.
- `urgency.ts`: `deadlineUrgency(open: boolean, startedOn, days, today)` com os mesmos kinds (`due-soon` a ≤ `DUE_SOON_DAYS`, `overdue` com `daysLate`); `dataRightsUrgency` vira um wrapper que mapeia status LGPD → `open` e chama com 15. Para o pedido, `open = isOpenServiceRequestStatus(status)` — andamento terminal não tem urgência.
- Resolver o prazo efetivo de um pedido (gravado ou calculado do default) é uma função pura do core que recebe o registro e o default do tenant — a UI nunca decide isso sozinha.

### 3. Default do tenant no padrão de overrides existente

- Default legal em código no `TenantSchema` (campo com `.default(...)`), valor inicial 30 dias corridos — o prazo geral de registro da Lei 6.015 (art. 188); comentário no código cita a fonte. Se o cartório entender que outro prazo do Provimento 149 se aplica, edita no painel — é exatamente o cenário que o campo editável existe para cobrir.
- `OfficeDeadlineSchema` em `overrides.ts` pelo mesmo pick-discipline dos outros quatro; persiste em `tenant_content` com chave própria. Sem migração.
- Edição em Ajustes, na aba que já reúne os dados operacionais (mesma tela dos contatos/horário).

### 4. Controle de prazo acoplado à troca de andamento

No detalhe do pedido, o formulário de troca de andamento ganha um controle opcional, colapsado por padrão, mostrando o prazo vigente ("até DD/MM · dia X de N") com três ações:
- **Manter** — default, nenhum clique a mais; o prazo não é tocado.
- **Zerar** — grava `deadline = { startedOn: hoje, days: vigentes }`.
- **Ajustar dias** — grava `deadline = { startedOn: vigente, days: N }` (campo numérico).

A server action de troca de status aceita o bloco opcional de prazo e grava tudo em uma escrita só; o evento de auditoria do andamento registra também a mudança de prazo quando houver. Alternativa considerada: ação separada "editar prazo" fora da troca de status — rejeitada como fluxo principal porque o pedido foi explicitamente "cada vez que mudar o status aparecer a opção", mas a mesma action pode ser chamada sem troca de status se a UI do detalhe quiser oferecer edição avulsa (decisão de UI, não de modelo).

### 5. O que o cidadão lê

- Consulta (`protocol-lookup`): mesma linguagem do LGPD — dentro do prazo mostra "dia X de N · previsão até DD/MM"; vencido mostra que o prazo está sendo revisto, sem exibir "vencido há N dias" ao cidadão (o tom acusatório é para o painel; para o cidadão a data prevista já passou e o texto diz que o cartório está atuando). Andamento terminal não mostra prazo.
- Emissão (confirmação do `/solicitar` e recibo do balcão): uma linha "prazo estimado de análise: até DD/MM", calculada do default do tenant.

## Risks / Trade-offs

- [Prazo calculado muda se o default do tenant mudar] → aceito e documentado (decisão 1); quem quiser congelar um prazo específico usa o controle por protocolo.
- [Operador zera o prazo repetidamente e o cidadão vê a previsão andar para frente] → é o comportamento pedido; a consulta mostra a previsão vigente sem histórico, e a auditoria guarda quem mexeu.
- [Texto "vencido" ao cidadão poderia gerar cobrança em vez de evitar] → decisão 5 evita a palavra no site público; painel mostra o número cru.
- [Details JSONB sem índice para "vencidos"] → fila calcula em memória como o LGPD; se um dia precisar de contador SQL de vencidos, promove-se a coluna (expand/contract em dois deploys, como manda o princípio).

## Open Questions

- Nenhuma bloqueante. Valor exato do default legal (30 dias) confirmável com o Joelison na entrega — trocar o número é um ajuste de config, não de desenho.

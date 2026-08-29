## Context

O canal LGPD já tem a mecânica completa de prazo: constante legal em `src/core/request/channels.ts` (`DATA_RIGHTS_DEADLINE_DAYS = 15`, com `dataRightsDeadline` e `dataRightsDayOfDeadline`), urgência em `src/core/overview/urgency.ts` (`dataRightsUrgency`, com `DUE_SOON_DAYS = 3`), badge no painel (`admin/(dashboard)/lgpd/_components/deadline-badge.tsx`) e contagem na consulta pública (`protocol-lookup.tsx`). O canal de pedidos (REQ) não tem nada disso, e é o canal com 18 andamentos, exigência e prazo que na prática "depende da demanda".

O pedido do cartório (Joelison) fixa três pontos de desenho que este documento apenas registra:
1. O protocolo nasce com o prazo que a lei exige para o ato; o cartório altera manualmente quando precisa.
2. O prazo é por protocolo, editável manualmente, inclusive nos lançados no balcão.
3. A cada troca de andamento o operador vê a opção de mexer no prazo — inclusive zerar, para o relógio recomeçar dali ("quando o processo é analisado, o prazo pode ser zerado... para já iniciar o prazo a partir de lá").
4. A previsão sempre diz que pode mudar conforme a ordem cronológica de atendimento.

## Goals / Non-Goals

**Goals:**
- Prazo por pedido como par (data de início, dias úteis), nascido do prazo legal do ato e editável na troca de andamento.
- Cidadão vê a situação do prazo na emissão e na consulta, sempre com a ressalva da ordem de chegada; operador vê urgência na fila e no detalhe.
- Reusar o calendário de dias úteis da agenda em vez de escrever outro.

**Non-Goals:**
- Prazo legal para os atos que a lei não fixa um, feriados municipais, prazos abaixo de um dia, pausa automática em exigência, prazo LGPD editável, urgência na Visão geral, notificações (ver Non-goals da proposta).

## Decisions

### 1. Prazo vive no `details` do pedido, não em coluna

`serviceRequestDetailsSchema` ganha um bloco opcional:

```ts
deadline: z.object({
  startedOn: isoDate,   // dia 0: a contagem começa no dia útil seguinte
  days: z.number().int().min(1).max(365),
}).optional()
```

- **Por quê**: zero migração; o JSONB `details` é exatamente o lugar de "campos que só um kind preenche", e todo write/read já passa pelo parse do core. Alternativa considerada: colunas `deadline_started_on`/`deadline_days` — daria índice e query SQL de vencidos, mas ninguém precisa dessa query hoje (a fila já carrega as linhas e calcula em memória, como o LGPD faz).
- **Ausente = calculado**: pedido sem `deadline` gravado conta de `createdAt` com o prazo legal do ato (ou o padrão do cartório). Protocolos antigos ganham prazo de graça, e a emissão não precisa gravar nada — só grava quem mexeu no prazo. Consequência aceita: mudar o prazo legal do ato ou o padrão do cartório reposiciona o prazo dos pedidos que nunca foram tocados; é o comportamento honesto ("o padrão mudou") e evita um backfill.

### 2. Núcleo: um módulo do pedido, sem mexer no do LGPD

- `core/request/deadline.ts`: `deadlineDate`, `businessDaysBetween`, `dayOfDeadline` e `effectiveDeadline`, todos em dias úteis.
- `urgency.ts`: `deadlineUrgency(open, startedOn, days, today)` para o pedido, com `due-soon` a ≤ `DUE_SOON_DAYS` e `overdue` com `daysLate`, ambos em dias úteis; `open = isOpenServiceRequestStatus(status)`, porque andamento terminal não tem urgência. `dataRightsUrgency` fica ao lado, intocada, com a contagem corrida da LGPD.
- Resolver o prazo efetivo é função pura do core, que recebe o registro, o prazo legal do ato e o padrão do cartório — a UI nunca decide isso sozinha.

### 3. O prazo nasce da lei, por ato, e o cartório cobre o resto

O protocolo nasce com o prazo que a lei fixa para o ato pedido. A ordem de precedência é: prazo gravado no pedido → prazo legal do ato → padrão do cartório.

- `Act.legalDeadlineDays` no catálogo (config as code, como o resto do ato), com `legalDeadlineNote` citando o artigo para a próxima pessoa conferir em vez de confiar.
- **Só entram prazos lidos da lei.** Onde nenhum artigo fixa prazo — todo ato notarial, e os procedimentos de rito próprio — o campo fica ausente. Prazo legal inventado é pior que prazo legal nenhum, e a primeira versão desta mudança errou exatamente assim (usou 30 dias citando o art. 188, que a Lei 14.382/2022 já tinha reescrito para 10).
- Os oito prazos encodados vêm da tabela conferida com a serventia: certidões de registro público em 5 dias (Lei 6.015 art. 19), situação jurídica do imóvel em 1, registro/averbação na matrícula em 10 (art. 188) e certidão de protesto em 5 (Lei 9.492 art. 27).
- O campo do painel deixa de ser "o prazo" e passa a ser o padrão **dos atos sem prazo legal**. Ele nunca sobrepõe um prazo legal: a serventia não configura a lei. `OfficeDeadlineSchema` em `overrides.ts` segue o pick-discipline dos outros quatro, persistido em `tenant_content`. Sem migração.

### 3b. Dias úteis, e só do lado que a lei manda

A Lei 14.382/2022 manda contar em dias úteis os prazos extrajudiciais, excluído o dia do protocolo, seguindo o CPC. A contagem do pedido segue isso, reusando `isBusinessDay`/`nationalHolidays` que a agenda já tinha — feriados fixos e os derivados da Páscoa saem de graça.

Uma contagem só para todos os atos, inclusive os que a regra de dias úteis não nomeia (RCPN, Notas). Dois motores seriam duas coisas para errar, e contar em dias úteis um ato que a lei contaria corrido só empurra a previsão para depois: a serventia promete no mínimo o que deve, e a tela nunca chama de atrasado um pedido que a lei ainda considera no prazo.

O canal LGPD **não** entra nessa contagem: os 15 dias são da Lei 13.709 art. 19, e a regra de dias úteis da 14.382 não os alcança. Contá-los em dias úteis daria três semanas que a serventia não tem. As duas contagens ficam lado a lado em `urgency.ts`, cada uma dizendo de qual lei é.

Limitação conhecida: feriados municipais e estaduais não são conhecidos aqui (mesma limitação da agenda), então um prazo que caia num deles conta como dia útil.

### 4. Controle de prazo acoplado à troca de andamento

No detalhe do pedido, o formulário de troca de andamento ganha um controle opcional, colapsado por padrão, mostrando o prazo vigente ("até DD/MM · dia X de N") com três ações:
- **Manter** — default, nenhum clique a mais; o prazo não é tocado.
- **Zerar** — grava `deadline = { startedOn: hoje, days: vigentes }`.
- **Ajustar dias** — grava `deadline = { startedOn: vigente, days: N }` (campo numérico).

A server action de troca de status aceita o bloco opcional de prazo e grava tudo em uma escrita só; o evento de auditoria do andamento registra também a mudança de prazo quando houver. Alternativa considerada: ação separada "editar prazo" fora da troca de status — rejeitada como fluxo principal porque o pedido foi explicitamente "cada vez que mudar o status aparecer a opção", mas a mesma action pode ser chamada sem troca de status se a UI do detalhe quiser oferecer edição avulsa (decisão de UI, não de modelo).

### 5. O que o cidadão lê

- Consulta (`protocol-lookup`): dentro do prazo mostra "dia X de N, em dias úteis, com previsão até DD/MM"; no dia do protocolo, quando nenhum dia útil correu, diz que a contagem começa no próximo dia útil; vencido mostra que o prazo está sendo revisto, sem exibir "vencido há N dias" ao cidadão (o tom acusatório é para o painel; para o cidadão a data prevista já passou e o texto diz que o cartório está atuando). Andamento terminal não mostra prazo.
- Emissão (confirmação do `/solicitar` e recibo do balcão): uma linha "prazo estimado de análise: até DD/MM", com o prazo legal do ato.
- Toda previsão mostrada ao cidadão carrega `DEADLINE_CAVEAT`: "A previsão pode mudar: os pedidos são atendidos por ordem de chegada." A serventia pediu que a ordem cronológica estivesse na tela em vez de ser descoberta por telefone.

## Risks / Trade-offs

- [Prazo calculado muda se o default do tenant ou o prazo legal do ato mudar] → aceito e documentado (decisão 1); quem quiser congelar um prazo específico usa o controle por protocolo.
- [Um prazo legal errado no catálogo vira promessa errada ao cidadão] → mitigado citando a fonte em cada entrada e deixando ausente tudo que não foi lido da lei; a tabela foi conferida com a serventia antes de entrar.
- [Feriado municipal conta como dia útil] → a previsão sai mais cedo que a real nesses dias; o controle por protocolo corrige caso a caso.
- [Operador zera o prazo repetidamente e o cidadão vê a previsão andar para frente] → é o comportamento pedido; a consulta mostra a previsão vigente sem histórico, e a auditoria guarda quem mexeu.
- [Texto "vencido" ao cidadão poderia gerar cobrança em vez de evitar] → decisão 5 evita a palavra no site público; painel mostra o número cru.
- [Details JSONB sem índice para "vencidos"] → fila calcula em memória como o LGPD; se um dia precisar de contador SQL de vencidos, promove-se a coluna (expand/contract em dois deploys, como manda o princípio).

## Open Questions

- Os treze atos sem prazo legal encodado ficam com o padrão do cartório. Se a serventia souber o prazo do Provimento 149 para algum deles, é só acrescentar `legalDeadlineDays` com a nota da fonte — o mecanismo já está pronto.

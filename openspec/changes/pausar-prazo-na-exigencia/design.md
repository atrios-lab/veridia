## Context

O prazo do pedido é o par `{ startedOn, days }` gravado em `details.deadline` (ou calculado do
`createdAt` com o prazo legal do ato ou o padrão do cartório: `effectiveDeadline`). A urgência é
função pura de prazo e "hoje" (`deadlineUrgency`), e "hoje" só para em andamento terminal. A change
`adicionar-prazo-do-protocolo` deixou "pausa automática em exigência" como non-goal e apostou no
botão **Zerar** como válvula manual; a fila mostrou o custo dessa aposta.

Dois fatos do código moldam o desenho:

1. **Ninguém guarda quando o pedido entrou em "Aguardando exigência".** O `audit_log` registra que
   o andamento mudou, não para qual. Congelar exige gravar o momento em que parou.
2. **A exigência tem data própria.** `service_request_requirements` guarda `createdAt` e
   `fulfilledAt`, e a exigência é desacoplada do andamento de propósito (transições livres). Um
   gatilho preso à exigência cadastrada tem lastro e tem data, inclusive para os pedidos já parados.

Base legal, a conferir com a serventia antes de a mudança ser arquivada (o texto abaixo foi escrito
de memória e precisa de olho humano no artigo):

- Lei 6.015, art. 188: prazo do oficial para registrar, dez dias úteis da prenotação (redação da Lei
  14.382/2022, que também manda contar os prazos extrajudiciais em dias úteis).
- Lei 6.015, art. 198: a exigência é formulada por escrito. Devolvido o título com a nota, não há ato
  do oficial pendente; o prazo dele não corre.
- Lei 6.015, art. 205: a prenotação caduca em vinte dias úteis se o interessado não atender às
  exigências. Esse prazo corre contra o cidadão e **não** suspende.
- Provimento CNJ 149/2023 (Código Nacional de Normas) e Provimento 172/2024: exigência única na
  nota devolutiva e prazo contado da reapresentação do título. Conferir redação exata e o Código
  de Normas da Corregedoria do estado.

Decisões tomadas com a serventia na exploração: pausa só com exigência cadastrada; "Aguardando
pagamento" entra, com o valor lançado como lastro; retomada zera quando o ato tem prazo legal;
selo neutro com contagem de espera enquanto pausado.

## Goals / Non-Goals

**Goals:**
- O relógio da serventia para enquanto a bola está com o cidadão, sem clique do operador, e volta
  sozinho quando o cidadão cumpre o que devia.
- A retomada segue a lei onde há lei (recomeça) e é conservadora onde não há (continua).
- A fila não perde o sinal de pedido parado: o selo vermelho errado vira um selo neutro certo.
- Pausas sobrepostas e repetidas (exigência → qualificação → exigência de novo) funcionam sem caso
  especial.

**Non-Goals:**
- Ver a lista de non-goals da proposta. Em especial: caducidade da prenotação, pausa LGPD, avisos por
  e-mail, pausa por andamento sem lastro.

## Decisions

### 1. A pausa é um campo do prazo gravado: `deadline.pausedOn`

`deadlineSchema` ganha `pausedOn: isoDate.optional()`. Presente significa "o relógio parou nesse dia";
ausente significa "correndo". Ao pausar um pedido que nunca teve prazo gravado, o prazo efetivo é
materializado (`startedOn`, `days`) junto com `pausedOn`, porque o campo precisa dos dois vizinhos
para fazer sentido.

- **Por quê aqui**: é o mesmo JSONB que o prazo já ocupa, `readDeadline` já é a porta única de
  leitura e todo write faz merge (`details || {...}`), então zero migração. Alternativa: derivar a
  pausa em tempo de leitura das exigências pendentes. Rejeitada porque a retomada precisa acumular
  (deslocar `startedOn`) e o pagamento não tem linha própria com data; um campo gravado cobre os dois
  motivos com uma regra só.
- **Um `pausedOn` para todos os motivos**: exigência e pagamento juntos contam uma pausa; ela só
  termina quando o último motivo some.

### 2. Motivos de pausa são função pura do registro

Em `core/request/deadline.ts`:

```ts
pauseReasons({ status, amountCents, pendingRequirements }) → ("requirement" | "payment")[]
```

- `"requirement"` quando há ao menos uma exigência com status `pending`.
- `"payment"` quando `status === "awaiting-payment"` e `amountCents != null`.

Sem valor lançado, "Aguardando pagamento" é só rótulo e não pausa: a regra "só com lastro" vale para
os dois motivos. O andamento "Aguardando exigência" sozinho não pausa nada.

### 3. Uma reconciliação, chamada depois de cada escrita que muda um motivo

`reconcileDeadlinePause(tenant, requestId, actorId)` em `lib/service-request.ts`: lê o pedido e as
exigências pendentes, calcula os motivos e:

| estado gravado | motivos | ação |
|---|---|---|
| correndo | algum | grava `pausedOn = hoje` (materializando o prazo efetivo se preciso); audita `service-request.deadline.pause` |
| pausado | nenhum | retoma (decisão 4), apaga `pausedOn`; audita `service-request.deadline.resume` |
| correndo | nenhum | nada |
| pausado | algum | nada |

Chamada pelas cinco server actions que mudam um motivo: registrar, cumprir e excluir exigência;
lançar ou remover valor; trocar andamento. Fica na action, não dentro de cada função da lib, porque a
reconciliação precisa do `Tenant` inteiro (prazo legal do ato e padrão do cartório) e as actions já o
têm; as funções da lib seguem com as assinaturas de hoje.

Alternativa: espalhar a lógica em cada função de escrita. Rejeitada: cinco lugares para errar a mesma
regra. Alternativa: trigger no banco. Rejeitada: a regra depende do catálogo de atos, que é código.

Andamento terminal não é tratado à parte: `deadlineUrgency` já devolve `closed` antes de olhar a
pausa, e um pedido cancelado com exigência pendente fica pausado sem efeito visível. Se reaberto,
continua pausado até a exigência ser cumprida ou excluída, que é o correto.

### 4. Retomada: zera onde a lei dá prazo novo, continua onde não dá

`resumeDeadline(deadline, today, hasLegalTerm)`:

- **Ato com `legalDeadlineDays`**: `{ startedOn: hoje, days }`. É o que a norma descreve para a
  reapresentação do título (prazo contado do reingresso) e o que a serventia pediu ("quando o
  processo é analisado, o prazo pode ser zerado"). Segue o princípio da change anterior: a tela nunca
  chama de atrasado o que a lei ainda considera no prazo.
- **Ato no padrão do cartório**: `startedOn` deslocado para a frente pelos dias úteis entre
  `pausedOn` e hoje (`deadlineDate(startedOn, businessDaysBetween(pausedOn, hoje))`). Ali não há regra
  legal e suspensão é o mais conservador com o cidadão.
- Pagamento segue a mesma regra que a exigência. A norma da reapresentação é sobre exigência; para
  o pagamento a escolha é de simplicidade, e fica registrada aqui como escolha.

### 5. Urgência ganha o estado `paused`, e "hoje" congela em `pausedOn`

`deadlineUrgency(open, deadline, today)` passa a receber o prazo inteiro. Com `pausedOn`, devolve
`{ kind: "paused", waitingDays, daysLeft }`, onde `waitingDays = businessDaysBetween(pausedOn, hoje)`
e `daysLeft` é calculado com `hoje = pausedOn`. A contagem "dia X de N" nas telas usa o mesmo "hoje"
congelado.

- **Fila e detalhe**: selo neutro "Aguardando o cidadão há N dias úteis" ("desde hoje" quando N é
  zero). Nem vermelho nem laranja: não é atraso da serventia.
- **Ordem na banda** (sobre o comparador de `fila-por-prioridade`): vencidos, depois vence em breve,
  depois pausados com mais tempo de espera no topo, depois os demais por chegada. O que espera há
  mais tempo é o que mais perto está de caducar, e é o que vale uma ligação.
- **Resumo do prazo no detalhe**: "Prazo: suspenso desde DD/MM · dia X de N".
- **Controles manuais durante a pausa**: zerar grava `startedOn = hoje` e mantém `pausedOn`; ajustar
  dias idem. O relógio continua parado, só que noutro ponto.

### 6. O que o cidadão lê

A consulta devolve `deadline.paused` com os motivos. Texto: "Prazo suspenso: aguardando o
cumprimento da exigência" / "aguardando o pagamento" / os dois. Sem data prevista enquanto suspenso,
porque a data depende do cidadão. Retomado, volta o texto de hoje ("dia X de N, com previsão até
DD/MM"). A ressalva `DEADLINE_CAVEAT` continua em toda previsão exibida.

### 7. Pedidos já parados: script único, com data real

Os pedidos abertos com exigência pendente recebem `pausedOn` igual à data da exigência pendente mais
antiga, que é o dia em que o relógio deveria ter parado. Os em "Aguardando pagamento" com valor e sem
exigência recebem `pausedOn = updatedAt`, aproximação declarada. O script materializa o prazo efetivo
como a reconciliação faria e audita como `service-request.deadline.pause` sem ator. Roda no Homolog
primeiro, com conferência visual da fila, depois em produção.

Alternativa: tratar "sem `pausedOn` mas com motivo" como pausado em tempo de leitura. Rejeitada: regra
mágica que ninguém vê e que faria a fila mudar sem histórico.

## Risks / Trade-offs

- [Exigência cadastrada como forma de parar o relógio sem devolver o título] → a pausa exige a
  exigência escrita, que é o lastro que a lei pede; a exigência única (Prov. 172) é regra da
  serventia, não do sistema. O histórico mostra quem registrou e quando.
- [Pedido pausado some do radar e caduca] → o selo de espera com contagem crescente e a ordem "mais
  tempo esperando no topo". O contador do art. 205 fica como próximo passo se a serventia sentir falta.
- [Retomada zerando parece "ganhar prazo" aos olhos do cidadão] → é o que a lei dá; a consulta mostra
  a previsão vigente e a ressalva da ordem de chegada, como hoje.
- [Fim de semana ou feriado dentro da pausa] → toda conta é em dias úteis com o calendário da agenda;
  feriado municipal segue a limitação já documentada.
- [Reconciliação esquecida numa action nova] → a regra vive numa função só; a tarefa de verificação
  lista as cinco actions e o e2e cobre registrar e cumprir exigência.
- [Ordem de arquivamento das specs] → os requisitos de prazo ainda estão só no delta de
  `adicionar-prazo-do-protocolo`. Os deltas desta change são requisitos novos e independentes;
  sincronizar ou arquivar a change anterior antes desta para as specs principais lerem em ordem.

## Migration Plan

1. Deploy do código (sem migração de schema).
2. Rodar o script de backfill no Homolog; conferir a fila e dois detalhes.
3. Rodar em produção; conferir os nove "Com pendência".
4. Rollback: reverter o deploy. `pausedOn` gravado é ignorado pelo código antigo (`deadlineSchema`
   com `z.object` descarta chaves desconhecidas), então nada quebra.

## Open Questions

- Confirmar com a serventia a redação atual do art. 188 e do Código de Normas da Corregedoria sobre o
  prazo contado da reapresentação: é o que sustenta "zerar quando há prazo legal".

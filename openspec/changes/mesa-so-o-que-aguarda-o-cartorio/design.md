## Context

A mesa (`rankDeskItems` em `src/core/overview/desk.ts`, alimentada por `listDeskItems` em
`src/lib/admin-overview.ts`) hoje recebe todo registro em status não terminal e apenas ordena.
Quem já foi respondido e espera o cidadão disputa vaga com quem espera a serventia, e o corte de
6 itens pode ser inteiramente consumido por itens em que não há nada a fazer.

O sinal de "de quem é a vez" já existe no banco, mas espalhado em duas tabelas, e essa é a única
decisão difícil desta mudança:

- `audit_log` registra o que a **serventia** faz (`actor_id` preenchido) e mais um único evento
  do cidadão, a criação do pedido pelo site (`actor_id` nulo, `service-request.ts:171`).
- `service_request_requirement_messages` registra a conversa da exigência, com
  `author` em `"citizen" | "staff"`. A mensagem do cidadão **não é auditada por decisão de
  projeto**: a auditoria é o registro dos atos da serventia sobre o registro do cidadão
  (ver o comentário em `writeStaffMessage`, `src/lib/service-request.ts:807`).

Restrições do projeto que valem aqui: regra de negócio em `src/core` puro, sem I/O; o transporte
(Drizzle, Next) só busca dados e chama o núcleo; nada específico de um cartório.

## Goals / Non-Goals

**Goals:**

- A mesa mostra só o que aguarda a serventia, com o item saindo e voltando sozinho.
- O sinal é derivado do que já é gravado; nenhuma coluna nova, nenhuma migração.
- A regra de "de quem é a vez" fica em `src/core`, testável sem banco.
- Nenhum item some do painel: o que sai da mesa continua na fila e em "Situação dos canais".

**Non-Goals:**

- Não muda a ordenação nem o limite de 6.
- Não cria marcação manual, soneca ou atribuição de item a operador.
- Não unifica a conversa da exigência com a auditoria, nem passa a auditar a mensagem do
  cidadão. Essa é uma decisão de projeto existente e esta mudança se adapta a ela.
- Não estende a conversa a LGPD e ouvidoria, que hoje não têm canal de réplica do cidadão.

## Decisions

### 1. Comparar duas datas, não ler "o último evento"

`awaitingOffice = lastCitizenAt > lastOfficeAt`, com `lastOfficeAt` ausente significando que a
serventia nunca agiu, logo a vez é dela.

- `lastCitizenAt` = `max(createdAt do registro, createdAt da última mensagem com author="citizen")`
- `lastOfficeAt` = `createdAt do evento mais recente em audit_log com actor_id preenchido`,
  excluídas as ações de rascunho e anotação interna.

**Alternativa descartada:** ler apenas `audit_log` e perguntar se o evento mais recente tem
ator nulo. É o que a leitura ingênua da tarefa sugere, e está errado: a resposta do cidadão não
entra na auditoria, então o item nunca voltaria para a mesa — que é metade do pedido. Este é o
motivo de a decisão estar documentada aqui e não deduzida no código.

**Alternativa descartada:** passar a auditar a mensagem do cidadão. Resolveria a leitura em uma
tabela só, mas inverte uma decisão de projeto deliberada e mistura ato da serventia com fala do
cidadão no mesmo registro. Custo alto para economizar uma consulta.

### 2. A criação sempre conta como ação do cidadão

`lastCitizenAt` parte de `serviceRequests.createdAt` independentemente de quem cadastrou. Assim
o pedido lançado no balcão nasce na mesa sem precisar de exceção escrita no código: a exceção
some porque a data de chegada é sempre do lado do cidadão.

### 3. O lado da serventia é uma lista de inclusão, não de exceções

`lastOfficeAt` considera apenas as ações auditadas que devolvem o registro ao cidadão: mudança
de andamento, exigência registrada, corrigida, respondida ou cumprida, e resposta de LGPD e de
ouvidoria.

Ficam de fora, e o motivo é o mesmo em todos os casos — não são resposta a ninguém:
`service-request.amount` e `service-request.key-reissue` são escrituração do balcão;
`data-rights.draft`, `ombudsman.draft` e `ombudsman.internal-note` são trabalho começado e não
enviado, o item que mais precisa continuar visível.

**Alternativa descartada:** listar as exceções e aceitar todo o resto. Foi a primeira forma
escrita, e a implementação mostrou o furo: o balcão grava `service-request.amount` logo depois
de criar o pedido, então um pedido lançado no balcão com valor informado nasceria fora da mesa
— justo o caso que a spec exige que apareça. Pior que o erro pontual é o padrão: numa lista de
exceções, toda ação nova entra valendo "tira da mesa" e some sem ninguém decidir. Na lista de
inclusão, o que ninguém classificou permanece visível, que é o lado seguro de errar.

### 4. Prazo legal de LGPD nunca sai da mesa

Um requerimento LGPD perto do prazo ou vencido (o tier 1 de `rankDeskItems`, via
`dataRightsUrgency`) permanece na mesa enquanto estiver em aberto, mesmo com ação recente da
serventia. O filtro é conveniência de fila; o prazo de 15 dias é obrigação legal. Trocar risco
de multa por uma linha a menos na mesa é a simplificação que não se faz.

### 5. O filtro mora em `rankDeskItems`, não na consulta

A consulta continua trazendo todo item em aberto e passa a anexar `awaitingOffice`; quem
descarta é o núcleo. Mantém a regra em `src/core`, deixa `countCriticalDeskItems` operando sobre
o conjunto completo, e o filtro fica coberto por `node --test` sem banco.

### 6. Duas consultas agregadas, restritas aos registros abertos

`listDeskItems` já busca as linhas abertas. Sobre os ids resultantes, duas agregações:
`max(created_at)` em `audit_log` agrupado por registro, e `max(created_at)` nas mensagens de
cidadão via join com `service_request_requirements`. Restringir aos ids abertos mantém as duas
consultas pequenas, em vez de varrer a auditoria inteira do tenant.

Detalhe que a implementação não pode ignorar: `audit_log.target_id` é texto e guarda ora o
`id` do registro, ora o `protocol_number` — a criação é auditada antes de a linha existir. O
casamento precisa cobrir as duas chaves, como `listRecentActivity` e `findResumePoint` já
fazem.

## Risks / Trade-offs

- **A mesa vazia vira comum e pode ser lida como "o sistema quebrou".** → O estado vazio ganha
  texto próprio dizendo que nada aguarda a serventia, com link para a fila; requisito na spec.
- **Ação da serventia que não gera auditoria deixaria o item preso na mesa.** → Falha para o
  lado seguro: o item continua visível. O caso conhecido, imprimir o pedido, é leitura e não
  deveria mesmo tirar da mesa.
- **Só o canal de pedidos tem réplica do cidadão.** LGPD e ouvidoria saem da mesa na primeira
  ação da serventia e não voltam, porque não existe caminho para o cidadão responder. É o
  comportamento correto hoje; se a ouvidoria ganhar réplica, a mesma função passa a cobri-la.
- **Duas consultas a mais por carregamento do painel.** → Restritas aos ids abertos e agregadas
  no banco. `audit_log` tem índice em `(tenant_slug, created_at)`, não em `target_id`: se o
  volume crescer, o índice em `target_id` é o próximo passo, não uma coluna desnormalizada.
- **Relógio e ordenação por igualdade.** Ação da serventia e do cidadão no mesmo instante são
  empate; o critério `lastCitizenAt > lastOfficeAt` resolve empate a favor da serventia ter
  respondido, o que tira o item da mesa. Aceitável: o cidadão voltando a escrever traz de volta.

## Migration Plan

Sem migração de banco e sem mudança destrutiva: nada é escrito de forma diferente, apenas lido.
A reversão é reverter o commit; nenhum dado fica em estado novo.

## Open Questions

- O texto exato do estado vazio da mesa é microcopy e será proposto na implementação.
- Se, com uso real, a serventia sentir falta de ver na mesa o que aguarda o cidadão, o caminho é
  uma aba ou contador em "Situação dos canais", não afrouxar o filtro.

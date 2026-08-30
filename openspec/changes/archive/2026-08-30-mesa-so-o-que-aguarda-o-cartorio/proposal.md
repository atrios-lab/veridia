## Why

Hoje a "Sua mesa hoje" lista todo item em aberto, ordenado por urgência. Um pedido que o
cartório já respondeu e que agora espera o cidadão continua ocupando uma das 6 vagas, e com
volume real a mesa vira uma segunda fila de pedidos: o operador precisa abrir item por item
para descobrir de quem é a vez. A mesa deixa de responder à única pergunta que justifica sua
existência — "o que espera por mim agora?".

Pedido registrado em SCRUM-15: mostrar na mesa os protocolos sem interação; quando o cartório
interage o item sai da mesa; quando o cidadão interage o item volta.

## What Changes

- A mesa passa a listar apenas os itens cuja vez é do cartório, em vez de todo item em aberto.
  A vez é do cartório quando a última ação do cidadão é mais recente que a última ação da
  serventia sobre aquele protocolo.
- Um item some da mesa assim que um operador age sobre ele, e volta sozinho quando o cidadão
  age de novo. Nenhum botão de "arquivar da mesa": o estado é derivado, não marcado à mão.
- O lado do cidadão SHALL ser lido de duas fontes, porque nenhuma sozinha o cobre: a criação do
  registro e as mensagens que ele escreve na conversa da exigência
  (`service_request_requirement_messages` com `author = "citizen"`). A mensagem do cidadão não
  é auditada por decisão de projeto — só o que a serventia faz vira registro de auditoria — de
  modo que ler apenas `audit_log` deixaria o item preso fora da mesa justamente quando o
  cidadão responde, que é o caso que o pedido quer resolver.
- O lado do cartório é a auditoria (`audit_log` com `actor_id` preenchido), que já cobre
  mudança de andamento, exigência registrada, exigência cumprida, resposta na conversa, valor
  informado e resposta de LGPD e ouvidoria.
- Duas exceções deliberadas ao "agiu, saiu", ambas para não esconder trabalho real:
  - **Rascunho não é resposta.** Salvar rascunho (`data-rights.draft`, `ombudsman.draft`) e
    salvar anotação interna (`ombudsman.internal-note`) não contam como ação da serventia. Uma
    resposta pela metade é justamente o que não pode sumir de vista.
  - **A chegada do trabalho conta pelo lado do cidadão, sempre.** A data de criação do registro
    entra como ação do cidadão mesmo quando o pedido foi lançado no balcão por um operador;
    caso contrário um pedido cadastrado manualmente nasceria fora da mesa.
- Itens que saem da mesa continuam inteiramente acessíveis em "Situação dos canais" e na fila
  de `/admin/pedidos`. Nada é escondido, só desempilhado.
- O aviso de corte ("mais N itens em aberto") passa a contar sobre os itens que aguardam o
  cartório, não sobre todos os abertos, para não anunciar um número que a mesa nunca mostraria.
- O estado vazio da mesa deixa de ser exceção e passa a ser o bom resultado do dia: o texto
  muda de "Nenhum item em aberto agora" para uma frase que diz que nada espera o cartório.

## Non-goals

- Não muda a ordenação entre os itens que ficam: LGPD urgente primeiro, exigência cumprida
  depois, resto do mais novo para o mais antigo. Só muda quem entra na lista.
- Não muda o limite de 6 itens.
- Não cria marcação manual de "resolvido na mesa", nem soneca, nem atribuição de item a
  operador. O estado continua derivado da auditoria.
- Não mexe no chat, na agenda do dia nem no bloco "Continuar de onde parou".
- Não altera o que a fila de `/admin/pedidos` mostra: lá continua tudo em aberto.
- Não adiciona coluna nova em `service_requests`. O sinal já existe na auditoria.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `admin-overview`: o requisito "Mesa de trabalho com urgências na frente e rotina do mais novo
  para o mais antigo" passa a filtrar por "aguarda o cartório" antes de ordenar; o requisito
  "Aviso de itens fora do corte da mesa" passa a contar sobre esse mesmo conjunto; e o estado
  vazio da mesa ganha requisito próprio.

## Impact

- `src/core/overview/desk.ts`: `DeskItemInput` ganha o sinal `awaitingOffice`; `rankDeskItems`
  filtra por ele antes de ordenar e cortar. Regra pura, testável sem banco.
- `src/lib/admin-overview.ts`: `listDeskItems` passa a resolver, por registro aberto, a data da
  última ação da serventia (`audit_log`) e a da última ação do cidadão (criação e mensagens da
  exigência). `DeskRecord` ganha o mesmo campo.
- `src/app/admin/(dashboard)/page.tsx`: repassa o campo e o novo total para o aviso de corte.
- `src/app/admin/(dashboard)/_components/desk-list.tsx`: texto do estado vazio.
- `openspec/specs/admin-overview/spec.md`: requisitos acima.
- Sem migração de banco: `audit_log.actor_id` e `service_request_requirement_messages.author`
  já carregam o sinal.
- Custo de consulta: duas leituras a mais, ambas restritas aos registros abertos do tenant.

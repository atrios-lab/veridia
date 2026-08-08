## Context

As Entregas 1 e 2 já deixaram prontos os mecanismos que os três canais desta entrega precisam:
protocolo sequencial por serventia e ano, chave de acesso com hash e verificação em tempo
constante, anexos com armazenamento em blob ou disco, rate limit por IP, honeypot invisível,
auditoria, PDF com `pdfkit` e a consulta por protocolo + chave. O prefixo de cada canal já está
declarado no núcleo (`PROTOCOL_PREFIXES`: `REQ`, `AGD`, `SOL`, `OUV`) e a consulta já nomeia os
quatro tipos (`PROTOCOL_TYPE_LABELS`).

O que falta é: (a) um lugar para gravar os três novos tipos de registro, (b) a regra de calendário
e de faixa de horário do agendamento, (c) os três formulários e suas confirmações, (d) a consulta
sabendo renderizar cada tipo. Nada disso pede tecnologia nova.

Restrições vigentes: regra de negócio em núcleo puro e testada com `node --test`; nenhum hex fora
do `@theme`; migração destrutiva exige dois deploys; texto visível em português vindo de
configuração; sem CAPTCHA (decisão da serventia, mantida).

## Goals / Non-Goals

**Goals:**

- Três formulários funcionando ponta a ponta, mobile-first, com o vocabulário do redesign.
- Uma única tabela, um único protocolo, uma única consulta para os quatro tipos de registro.
- Disponibilidade de horário derivada do que já está gravado — sem serviço de agenda, sem reserva.
- Reaproveitar chave, anexo, rate limit, honeypot, auditoria e PDF sem reescrever nenhum deles.

**Non-Goals:**

- Painel admin dos três canais (propor horário, responder titular, tratar manifestação): Entrega 6.
- Notificação ativa (e-mail/WhatsApp): entrega própria.
- Reserva firme de horário, agenda por atendente, fila do balcão.
- Feriado municipal/estadual e recesso da serventia.

## Decisions

### 1. Um registro do cidadão, quatro tipos — não quatro tabelas

`service_requests` ganha `kind` (`service-request` | `appointment` | `data-rights` | `ombudsman`)
e passa a servir os quatro canais.

Por quê: o design da Entrega 3 coloca `AGD`, `SOL` e `OUV` na **mesma** consulta, com a mesma
chave, o mesmo andamento e o mesmo bloco "É a sua vez" da Entrega 2 — e, na Entrega 6, na mesma
fila do admin. Quatro tabelas dariam quatro consultas, quatro verificações de chave, quatro
tabelas de anexo e quatro filas para reconciliar depois. O que difere entre os canais são três a
cinco campos, não a natureza do registro.

Alternativa considerada: uma tabela por canal, com uma view de união para a consulta. Rejeitada:
paga estrutura em quatro lugares para economizar nulos em um.

Consequências no schema (todas expand-only, um deploy):

- `kind text NOT NULL DEFAULT 'service-request'` — o default é o que classifica corretamente todas
  as linhas já gravadas.
- `details jsonb NOT NULL DEFAULT '{}'` — o que é específico de cada canal (dia e faixa, direito
  escolhido, tipo de manifestação, sigilo). Lido sempre por um schema Zod do núcleo, nunca cru.
- `office_reply text` + `office_replied_at timestamptz` — a resposta do DPO e a da ouvidoria.
- `act_id`, `attribution`, `applicant_name`, `contact` e `access_key_hash` perdem o `NOT NULL`:
  agendamento não tem ato, manifestação anônima não tem nome, contato nem chave. A obrigação passa
  a ser por canal, no schema Zod que já é a fronteira de validação.
- O índice único de sequência passa de `(tenant, ano, sequência)` para
  `(tenant, kind, ano, sequência)`: cada canal tem a própria numeração, como o design mostra
  (`AGD.2026.000067` convivendo com `SOL.2026.000031`). O índice único de `protocol_number` por
  serventia continua garantindo que dois registros nunca compartilhem número impresso.

O afrouxamento de `NOT NULL` é a única perda real: o banco deixa de recusar um pedido de serviço
sem nome. Mitigação: o núcleo continua exigindo, e o teste de banco cobre a criação de cada canal.

### 2. Disponibilidade é contagem, não reserva

Uma faixa está ocupada quando `count(*)` de agendamentos vivos (`requested`, `proposed`,
`confirmed`) naquele dia e naquela faixa alcança `capacityPerSlot`. Não há linha de "vaga", não há
lock, não há expiração de carrinho.

Por quê: o pedido não é reserva — o design é explícito ("Este é um **pedido** de horário"). Duas
pessoas pedirem a mesma faixa no mesmo segundo é resolvido pela serventia, que é quem confirma. Um
sistema de reserva com bloqueio temporário resolveria um problema que a serventia não tem, com
custo alto de estado.

Consequência aceita: a contagem pode passar da capacidade por corrida. O servidor revalida a faixa
no envio (recusa com o próximo dia livre) e a serventia contra-propõe quando ainda assim estourar.

### 3. Calendário puro, com "hoje" injetado

`src/core/scheduling/calendar.ts`: dias úteis, feriados nacionais e faixas de horário, sem I/O e
sem ler o relógio. Toda função recebe a data de referência como `YYYY-MM-DD`.

- Feriados fixos em lista; móveis (carnaval, sexta-feira santa, Corpus Christi) calculados a partir
  da Páscoa pelo algoritmo de Meeus/Butcher — aritmética de umas quinze linhas, contra uma
  dependência ou uma tabela que envelhece todo ano.
- O "hoje" da serventia sai de `Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" })` na
  camada de transporte e entra puro no núcleo. O servidor roda em UTC; sem isso, das 21h em diante
  o site ofereceria o dia seguinte como se fosse hoje.
- Datas trafegam e são gravadas como `YYYY-MM-DD` e a faixa como hora inteira (`9` = 9h—10h).
  Nenhum `Date` com fuso atravessa o formulário.

### 4. Janela de atendimento vira configuração estruturada

`Tenant` ganha `scheduling: { startHour, endHour, capacityPerSlot }`, com default 8/14/2 no schema
Zod. `openingHours` continua sendo a frase que o cidadão lê ("Segunda a sexta, das 8h às 14h").

Por quê: as faixas precisam de números; extrair número de prosa em português é o tipo de parser que
quebra na primeira serventia que escreve diferente. Duas fontes para o mesmo fato é o custo — e a
frase é a que aparece na tela, então a divergência seria visível e corrigível.

### 5. Formulários e telas: mesmo molde do `/solicitar`

Cada canal segue o que já existe: página Server Component (contexto, garantias, dados da
serventia), formulário Client Component com `react-hook-form` + `zodResolver` sobre o schema do
núcleo, Server Action que revalida tudo (rate limit → honeypot → Zod → gravação → auditoria) e
devolve `useActionState`. Cliente é UX; servidor é fronteira de confiança.

Extração nova, justificada por repetição real: o bloco "protocolo + chave com aviso de que aparece
só agora e botão copiar" passa a viver em `(public)/_components/protocol-reveal.tsx` — hoje existe
uma vez em `/solicitar`, e esta entrega o pediria mais três. O restante das telas de confirmação
não vira componente: são conteúdos diferentes com a mesma casca de estilo.

### 6. Ouvidoria anônima não recebe chave

`access_key_hash` fica nulo quando não há identificação. A consulta de um `OUV` anônimo responde
"registro ou chave inválidos" — a mesma resposta de protocolo inexistente.

Por quê: gerar chave para um registro sem dados pessoais é prometer um canal de resposta que não
existe e criar credencial para conteúdo que não tem dono verificável. O design diz isso ao cidadão
com todas as letras na confirmação, e a confirmação ensina o caminho para ter resposta (registrar
com contato, ou pedir sigilo em vez de anonimato).

### 7. Consulta renderiza por tipo, com andamento derivado

A action de consulta passa a devolver um union discriminado por `kind`; `protocol-lookup.tsx`
escolhe o bloco a renderizar. O andamento (linha do tempo) é montado das datas do próprio registro
— `createdAt`, `officeRepliedAt`, marcas em `details` (proposta, aceite) e o `status` atual.

Por quê: uma tabela de eventos do cidadão só se paga quando existe quem escreva eventos, e quem
escreve é o admin da Entrega 6. Enquanto o registro tem três a quatro momentos, derivá-los é menos
código e não pode divergir do registro.

### 8. Downloads por POST, nunca por query string

O `.ics` do agendamento e o recibo em PDF do canal LGPD seguem o `/solicitar/requerimento`: rota
`POST` com protocolo e chave no corpo do formulário, resposta `private, no-store`, e um único
"Não encontrado" para protocolo inexistente e chave errada. Chave em query string entra no
histórico do navegador e em todo log do caminho.

O `.ics` é texto montado à mão no núcleo (VCALENDAR/VEVENT, umas vinte linhas com escape de
vírgula e quebra) — nenhuma biblioteca para o que é um formato de linhas.

### 9. "Falar no chat" aponta para o WhatsApp

O estado de dia lotado oferece o contato da serventia (WhatsApp da configuração) no lugar do chat,
até a Entrega 8. O botão não é escondido: o cidadão sem faixa livre precisa de saída agora.

## Risks / Trade-offs

- **Nulos em colunas que antes eram obrigatórias** → o núcleo valida por canal e os testes de banco
  cobrem a criação de cada tipo; a garantia sai do banco e passa a ter dono explícito no código.
- **Corrida na capacidade da faixa** → revalidação no envio e contraproposta da serventia; o pedido
  nunca foi reserva.
- **Consulta de `AGD`/`SOL`/`OUV` sem quem escreva do lado da serventia** → os estados de resposta e
  proposta são renderizados a partir de campos que a Entrega 6 vai preencher; nesta entrega eles são
  exercitados por seed nos testes, o que é honesto e deixa o contrato pronto.
- **`details` em JSONB não é validado pelo banco** → todo acesso passa por um schema Zod do núcleo,
  na leitura e na escrita; o custo é lembrar que a única porta é essa.
- **Contagem de ocupação sem índice dedicado** → volume de uma serventia municipal é de dezenas de
  agendamentos por dia; se a consulta pesar, o caminho é um índice parcial sobre
  `kind = 'appointment'` e o dia dentro de `details`.
- **Duas fontes para o horário de atendimento** (frase e números) → ficam lado a lado no mesmo
  arquivo do tenant, e a frase é a que aparece na tela.

## Migration Plan

Deploy único, expand-only: adicionar `kind` (com default), `details`, `office_reply`,
`office_replied_at`; remover `NOT NULL` das cinco colunas; criar o índice único
`(tenant, kind, ano, sequência)` e remover o antigo `(tenant, ano, sequência)`. As linhas
existentes viram `kind = 'service-request'` pelo default, e sua numeração continua válida porque
o prefixo `REQ` já era o único em uso.

Rollback: reverter o código. O schema novo continua servindo o código antigo (colunas novas têm
default e são ignoradas; a única exigência é não ter gravado registros dos canais novos antes do
rollback, caso em que a contração do índice teria de esperar). Nenhuma coluna é removida ou
renomeada nesta entrega.

## Open Questions

- Capacidade por faixa (`capacityPerSlot`) começa em 2 para as duas serventias configuradas. É um
  número que a serventia deve poder ajustar sem deploy? Se sim, migra para `tenant_branding`/
  conteúdo editável na entrega do admin.
- Prazo de expiração da proposta de horário ("sem resposta em 2 dias úteis, a proposta expira",
  no design): quem expira? Nesta entrega o texto é exibido e a expiração é decidida pela serventia;
  a rotina automática, se houver, nasce com o admin.

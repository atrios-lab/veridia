## Context

Nenhuma infraestrutura de tempo real existe hoje (sem WebSocket, sem SSE, sem fila de mensagens,
sem serviço terceirizado) — confirmado por busca no repositório inteiro. O deploy é Vercel, com
funções serverless que não sustentam conexão longa de forma confiável, e o middleware aplica uma
CSP estrita (`connect-src 'self'`) que trataria qualquer host de tempo real externo como uma
exceção a revisar. Não há tabela de usuário além de `user`/`session` do Better Auth (um papel, uma
serventia por usuário, sem conceito de setor ou de presença). O padrão já estabelecido para
"coisa que o cidadão registra sem conta" é protocolo + chave de acesso (hash), usado pelos quatro
canais existentes — mas todos eles são "uma submissão, uma resposta eventual", nunca uma troca
contínua de mensagens.

O design importado (`Redesign 08`) desenha oito telas (8a–8f) para os dois lados da mesma
conversa. A referência de comportamento é esse design mais os textos dos User Stories (US-01 a
US-21) do pedido original — nunca um sistema de cartório anterior; este é software novo.

## Goals / Non-Goals

**Goals:**
- As oito telas do design funcionando com dado real, sem mock, dentro da stack já aprovada.
- Uma conversa é um recurso só, consumido pelos dois lados (widget e console) através do mesmo
  núcleo de domínio — sem regra de negócio duplicada em client component nenhum.
- Nenhuma dependência nova de infraestrutura (sem serviço de tempo real, sem provedor de e-mail,
  sem fila de tarefas).

**Non-Goals:**
- Latência de tempo real de verdade (sub-segundo). Sondagem por polling aceita alguns segundos de
  atraso — ver Decisions.
- Suporte a múltiplas abas/dispositivos por cidadão na mesma conversa (o widget assume uma sessão
  de navegador por conversa).
- Qualquer envio de e-mail (ver proposal.md, Non-Goals).

## Decisions

### Conversa e mensagem como tabelas próprias, fora de `service_requests`

`service_requests` modela bem "uma submissão, uma resposta eventual" (os quatro `RequestKind`
existentes). Conversa é outra forma: muitas linhas por registro (mensagens), um atendente
atribuído que muda ao longo da vida do registro (transferência), e leitura de alta frequência dos
dois lados ao mesmo tempo (sondagem). Forçar isso em `details jsonb` repetiria o problema que
`add-admin-service-requests` já resolveu para exigência ("um blob JSON compartilhado por dois
escritores é como um sobrescreve o outro") multiplicado por dezenas de mensagens por conversa.

Duas tabelas novas:

- `chat_conversations`: `id`, `tenant_slug`, `status` (`waiting` | `active` | `closed`),
  `citizen_name`, `citizen_contact`, `subject`, `informed_protocol_number` (texto livre, o que o
  cidadão digitou), `matched_request_id` (FK opcional para `service_requests`, preenchido se o
  protocolo informado bate com um registro real), `source_path` (a página do site onde o cidadão
  abriu o widget), `assigned_user_id` (FK opcional para `user`), `assigned_sector` (atribuição
  opcional, copiada do atendente no momento em que assume — histórico não muda se o atendente
  trocar de setor depois), `last_activity_at`, `waiting_since`, `closed_at`, `closed_reason`
  (`citizen` | `inactivity` | `staff`), `linked_request_id` (FK opcional para `service_requests`,
  preenchido no encerramento), `rating` (1–5, opcional), `rating_comment` (opcional),
  `wants_transcript_email` (boolean), `created_at`.
- `chat_messages`: `id`, `conversation_id` (FK cascade), `tenant_slug`, `author_type`
  (`citizen` | `staff` | `system` | `note`), `author_user_id` (FK opcional, presente quando
  `staff`/`note`), `body`, `attachment_*` (mesmas quatro colunas de `service_request_attachments`,
  nulas quando a mensagem não é anexo), `created_at`. Índice em `(conversation_id, created_at)`
  para a sondagem incremental.

`note` é seu próprio `author_type`, não uma flag em cima de `staff`: uma nota nunca é enviada ao
cidadão, então tratá-la como o mesmo tipo com um booléano a mais é o tipo de campo que uma consulta
esquece de filtrar. Mensagens de transferência geram duas linhas — uma `system` (o aviso que o
cidadão lê) e uma `note` (a justificativa obrigatória, só para a equipe) — presas ao mesmo
`created_at`, então a conversa mostra as duas juntas para quem tem acesso a notas.

Alternativa considerada: uma tabela só, com `kind` distinguindo conversa de mensagem via
auto-referência. Rejeitada — conversa e mensagem têm ciclos de vida e colunas completamente
diferentes; forçar as duas num esquema comum só complica a leitura sem ganhar nada.

### Sem protocolo nem chave de acesso para a conversa

Os quatro canais existentes dão um protocolo e uma chave porque o cidadão precisa voltar depois,
de qualquer dispositivo, e provar que aquele registro é dele. Conversa não tem esse requisito: o
design nunca mostra "consulte seu atendimento pelo protocolo", e o widget só precisa sobreviver a
um recarregamento de página na mesma sessão de navegador. A identidade da conversa é um token
opaco gerado no pré-chat, guardado em cookie `httpOnly`/`sameSite=lax` escopado ao host da
serventia (mesmo padrão de cookie de sessão do Better Auth), nunca em `localStorage` — evita que
qualquer script no domínio (ou uma extensão) leia ou forje o vínculo. O servidor guarda o hash do
token (mesma função de `hashAccessKey`), nunca o valor puro.

Consequência aceita: se o cidadão limpar cookies, trocar de aba anônima ou mudar de aparelho no
meio do atendimento, a conversa fica órfã do lado dele (o atendente ainda a vê e pode encerrá-la
por inatividade). É o comportamento do próprio design — a fila avisa "mantenha esta janela
aberta" — então isso não é uma lacuna nova, é o que a tela já promete.

### Tempo real por sondagem (polling) de Route Handler, não WebSocket

Três opções: (a) WebSocket próprio — não sobrevive a função serverless da Vercel sem uma camada
adicional (Edge com estado, ou um servidor à parte fora do deploy único); (b) serviço terceirizado
(Pusher/Ably/Supabase Realtime) — dependência nova, custo novo, e exige abrir a CSP
(`connect-src 'self'`) para um host externo, que hoje é lista fechada; (c) sondagem periódica de
um Route Handler same-origin.

Escolha: (c). `GET /api/chat/[conversationId]?after=<cursor>` devolve mensagens novas e o estado
da conversa; o widget sonda a cada ~4s enquanto a aba está visível (`document.visibilityState`,
para não gastar sondagem em aba em segundo plano) e o console do atendente sonda a fila a cada
~5s e a conversa aberta a cada ~3s. `isRateLimited` (já existe, Upstash) protege o endpoint do
mesmo jeito que protege os outros formulários públicos.

Trade-off aceito: mensagem nova demora até um ciclo de sondagem para aparecer do outro lado
(poucos segundos), não é instantâneo. Aceitável para um canal de atendimento textual — nenhum
User Story pede latência sub-segundo — e mantém a stack sem dependência nova. Se o volume real
provar que isso incomoda, um upgrade para SSE (mesma origem, sem mudar CSP) é o próximo passo
natural, sem migração de dado.

### Setor do atendente é campo opcional no convite, não uma tela nova

O design mostra cada colega na lista de transferência com um setor ("Registro Civil", "Notas e
Protesto"). Não existe tela de gestão de usuários hoje (`nav.ts` não lista "Usuários" porque a
rota não existe), e criar uma está fora do escopo desta mudança. `chat_sector` entra como campo
adicional opcional em `user` (`USER_ADDITIONAL_FIELDS`, mesmo mecanismo de `role`/`tenant_slug`),
atribuído por quem roda `scripts/invite-admin.ts` ou o seed — nulo é um estado válido, e a lista de
transferência mostra só nome e status quando ausente. `Attribution` (RCPN, NOTAS, RI, PROTESTO,
RTD, RCPJ) é reaproveitado como o vocabulário do setor: são as mesmas seis atribuições que já
governam o resto do sistema, não um vocabulário novo para inventar e manter em sincronia.

### Inatividade e fechamento automático avaliados de forma preguiçosa, sem cron

Não há Vercel Cron nem fila de tarefas na stack aprovada, e adicionar um só para "feche a conversa
depois de 10 minutos" é desproporcional. Em vez de um processo em segundo plano, toda leitura de
uma conversa `active` (pela sondagem do widget, do console, ou por uma ação do atendente) primeiro
chama uma função pura — `isStale(conversation, now)` — que decide se passou de 10 minutos desde
`last_activity_at` sem resposta do cidadão; se sim, a própria leitura grava o fechamento
(`closed_reason: "inactivity"`) e a mensagem de sistema, antes de devolver o estado. A conversa
fecha, na prática, na primeira leitura depois dos 10 minutos — não no segundo exato — que é
suficiente para o que o produto promete ("a gente não deixa isso aberto para sempre"), não uma SLA
de precisão.

O aviso "Ainda está aí?" (aos ~8 minutos, dois minutos antes do fechamento) segue a mesma lógica:
calculado na leitura, não agendado.

### `assigned_sector` é copiado, `chat_sector` do usuário é a fonte

Ver acima em `chat_conversations`: a coluna é uma cópia tirada no momento em que o atendente
assume, não uma junção com `user.chat_sector` toda vez que a conversa é lida. Histórico de
atendimento tem que continuar dizendo "Registro Civil" mesmo que aquele atendente mude de setor
mês que vem — o mesmo raciocínio já aplicado a `service_requests.attribution`, que também não é
uma referência viva ao catálogo.

### Limite de 3 conversas é checado na ação, não reservado

"Atender" conta, no momento do clique, quantas conversas `active` têm `assigned_user_id` igual ao
ator; recusa a quarta no servidor (o botão também some no cliente quando o número bate, mas isso é
cortesia, não a checagem). Sem reserva otimista nem fila de prioridade — duas abas do mesmo
atendente clicando "Atender" ao mesmo tempo em conversas diferentes é uma corrida real, mas rara o
bastante (uma pessoa, uma tela) para não justificar lock. Se acontecer, o quarto "Atender" falha
com a mensagem "Você já está em 3 atendimentos" e a conversa volta para a fila.

## Risks / Trade-offs

- **Sondagem gera mais requisições que WebSocket** → em volume alto (muitas conversas simultâneas
  por serventia), o Route Handler de sondagem vira o ponto mais chamado do sistema. Mitigação:
  intervalo maior que o "instantâneo" (4–5s), pausa quando a aba não está visível, e o cursor
  (`after=`) mantém a resposta pequena (só mensagens novas, nunca a conversa inteira de novo).
- **Fechamento por inatividade só acontece em leitura** → uma conversa sem ninguém olhando (widget
  fechado, console fechado) fica tecnicamente `active` além dos 10 minutos até a próxima leitura
  de qualquer lado. Mitigação: o console soa a fila e as conversas atribuídas continuamente
  enquanto a aba de atendimento estiver aberta, que é o caso normal de uso; sem SLA de precisão
  prometida a ninguém.
- **Sem protocolo/chave para a conversa** → um cidadão não recupera uma conversa encerrada nem a
  reabre de outro aparelho. Aceito, documentado como Non-Goal (ver proposal.md) — o design nunca
  desenha essa necessidade.
- **`chat_sector` sem tela de edição** → corrigir o setor de um atendente exige rodar o script de
  convite de novo ou editar direto no banco, até a tela de Usuários existir. Mitigação:
  documentado aqui para quem construir essa tela depois; o campo já está pronto para ganhar UI sem
  migração nova.

## Migration Plan

Migração Drizzle única, aditiva: tabelas novas `chat_conversations` e `chat_messages`; colunas
novas `chat_status` e `chat_sector` em `user` (Better Auth). Nenhuma coluna removida ou renomeada
— não precisa dos dois deploys de migração destrutiva.

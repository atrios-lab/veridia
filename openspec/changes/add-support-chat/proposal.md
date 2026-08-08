## Why

O cidadão que precisa de uma resposta rápida hoje não tem canal síncrono nenhum: os quatro canais
existentes (`pedidos`, `agendamento`, `dpo-lgpd`, `ouvidoria`) são todos formulário-e-espera, sem
ninguém do outro lado em tempo real. O design importado (`Redesign 08`) já prevê o indicador
"Disponível para o chat" no cabeçalho do painel — a proposta de `add-admin-service-requests`
deliberadamente o deixou como "aceno visual sem estado nenhum por trás" e registrou "Atendimento
online é entrega futura". Esta é essa entrega: atendimento síncrono, dos dois lados — o widget que
qualquer página do site público oferece e o console onde a equipe atende, transfere e encerra.

## What Changes

- Botão flutuante "Atendimento online" em toda página pública, condicionado ao interruptor da
  serventia e ao horário de atendimento configurado (`tenant.scheduling`); contador de mensagens
  não lidas; aparência neutra fora do horário; some quando a serventia desliga o chat.
- Pré-chat (nome, e-mail ou telefone, assunto, protocolo opcional) antes de entrar na fila; se o
  cidadão informa um protocolo existente, ele é localizado e mostrado ao atendente. Fila com
  posição e estimativa, com opção de desistir.
- Conversa do cidadão: mensagens, anexos, indicação de quem atende (nome e setor), aviso de
  sistema quando transferido — nunca mostra nota interna. Aviso de inatividade aos 10 minutos sem
  resposta, com encerramento automático se não houver reação. Fora do horário, tela fechada sem
  aceitar recado, com os canais que seguem funcionando sozinhos. Ao encerrar: avaliação (estrelas
  + comentário opcional) e preferência de receber a transcrição por e-mail (a entrega do e-mail em
  si fica fora de escopo, ver Non-Goals).
- Console do atendente (novo, `/admin/atendimento`): fila de espera (assunto, protocolo informado,
  tempo de espera colorido por urgência) e "Atender"; conversa com atalho para o pedido vinculado,
  respostas prontas, notas internas (visíveis só à equipe); status pessoal (Disponível/Ocupado/
  Ausente) com limite de 3 conversas simultâneas; transferência para colega específico (com carga
  e status visíveis) ou devolução à fila geral, com nota interna obrigatória; ao encerrar, vincular
  a transcrição a um protocolo existente, lançar um pedido novo a partir da conversa, ou só
  encerrar — transcrição retida por 6 meses.
- Interruptor "Disponível para o chat" da serventia (só quem tem a permissão de configuração):
  desligado, o botão some do site na hora; conversas em andamento seguem até serem encerradas.
- Contador de conversas aguardando na sidebar do painel, visível em qualquer tela (mesmo padrão do
  contador de "Pedidos de serviço").
- Sem transporte de tempo real novo: atualização por sondagem (polling) de um Route Handler, para
  não introduzir dependência externa nem exceção na CSP (`connect-src 'self'`). Latência-alvo de
  poucos segundos, não instantânea — ver design.md.

## Non-Goals

- **Não** envia e-mail nenhum (nem transcrição, nem confirmação de pré-chat). Não existe
  infraestrutura de e-mail no projeto hoje; a preferência do cidadão ("receber a transcrição por
  e-mail") é registrada, mas a entrega fica para uma mudança futura que trouxer um provedor de
  e-mail. A tela não promete o que ela não faz — o texto de confirmação é sincero sobre isso.
- **Não** usa WebSocket nem serviço de tempo real terceirizado (Pusher, Ably, Supabase Realtime).
  Fora da stack aprovada (`openspec/config.yaml`) e exigiria abrir a CSP para um host externo.
- **Não** constrói tela de gestão de usuários nem de setor por atendente. O "setor" mostrado ao
  lado do nome de cada colega no design (ex. "Registro Civil") vem de um campo opcional atribuído
  no convite/seed do usuário (mesma via que já define `tenantSlug`/`role` hoje), não de uma tela
  nova — se ausente, a transferência mostra só o nome e o status.
- **Não** modela conversa como um quinto `RequestKind` dentro de `service_requests`. Diferente dos
  quatro existentes (uma submissão, uma resposta), conversa tem muitas mensagens, atribuição a um
  atendente e presença — tabelas próprias, ver design.md.
- **Não** implementa CAPTCHA nem verificação de identidade no pré-chat; usa o mesmo padrão de
  campo-armadilha e limite de taxa já usado nos outros canais.
- **Não** cobre a análise/relatório dos atendimentos (tempo médio, satisfação agregada) — só o
  registro por conversa. Fica para uma mudança futura de relatórios do painel.
- **Não** permite ao cidadão reabrir uma conversa encerrada, nem consultá-la depois pelo protocolo
  (diferente dos quatro canais existentes, a conversa não tem protocolo próprio nem chave de
  acesso — ver design.md, Decisions). Uma vez encerrada, só existe do lado do painel.

## Capabilities

### New Capabilities

- `support-chat`: o widget do cidadão — botão flutuante, pré-chat, fila, conversa, encerramento,
  avaliação — e o núcleo do domínio de conversa (estados, mensagens, horário de atendimento,
  inatividade) que o console do atendente também consome.
- `admin-support-chat`: o console do atendente — fila operacional, atender, status pessoal e
  limite de conversas, respostas prontas, notas internas, transferência, encerramento vinculado a
  protocolo ou a um pedido novo, e o interruptor "Disponível para o chat" da serventia.

### Modified Capabilities

- `admin-shell`: novo item de navegação "Atendimento online" (grupo "Canais do cidadão"), com
  contador de conversas aguardando, atrás da permissão nova `chat.manage`. O cabeçalho do painel
  ganha o indicador "Disponível para o chat" com estado real, substituindo o aceno visual sem
  lógica registrado como Non-Goal em `add-admin-service-requests`.
- `service-request`: pedido de serviço passa a poder nascer de uma conversa encerrada (mesmo
  caminho do lançamento manual, com a origem registrada) e a exibir, no seu histórico, as
  transcrições de conversa vinculadas a ele.

## Impact

- `src/db/schema.ts`: tabelas novas `chat_conversations`, `chat_messages` (ver design.md para
  colunas); migração Drizzle aditiva.
- `src/db/auth-schema.ts`: campos adicionais em `user` — `chat_status` (available/busy/away) e
  `chat_sector` (atribuição opcional, nullable) — via `USER_ADDITIONAL_FIELDS` do Better Auth.
- `src/core/chat/` (novo): domínio puro — estados da conversa, cálculo de "está no horário de
  atendimento" (reaproveitando `src/core/scheduling/calendar.ts`), regra de inatividade/
  fechamento automático (avaliada de forma preguiçosa na leitura, sem cron), limite de 3
  conversas simultâneas, respostas prontas (lista fixa), validação Zod de mensagem e pré-chat.
- `src/core/auth/roles.ts`: permissões novas `chat.manage` (admin + staff) e `chat.settings`
  (admin, mesmo padrão de `billing.edit`).
- `src/lib/chat.ts` (novo): leitura/escrita — abrir conversa, localizar protocolo informado,
  entrar/sair da fila, enviar mensagem, assumir, transferir, encerrar (com ou sem vínculo),
  registrar avaliação, contar conversas aguardando, sondagem incremental (mensagens após um
  cursor).
- `src/lib/uploads.ts`: reaproveitado para anexos de chat, com `kind: "chat"` novo.
- `src/app/(public)/_components/chat-widget.tsx` (novo) + `src/app/(public)/layout.tsx`: monta o
  widget globalmente, condicionado ao interruptor e ao horário.
- `src/app/api/chat/`: Route Handlers de sondagem e envio (mensagens, presença da fila), com
  `isRateLimited` reaproveitado.
- `src/app/admin/(dashboard)/atendimento/`: rotas novas (fila + conversa) e `actions.ts`.
- `src/app/admin/_components/nav.ts` e cabeçalho do painel: item novo com contador; indicador
  "Disponível para o chat".
- `src/app/admin/(dashboard)/pedidos/[protocolo]/page.tsx`: bloco novo "Atendimentos vinculados".
- Testes: `src/core/chat/*.test.ts`, `src/db/chat.test.ts` (PGlite), `e2e/support-chat.spec.ts`
  novo (widget completo) e `e2e/admin-support-chat.spec.ts` novo (console completo).

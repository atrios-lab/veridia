## Why

A Visão geral atual (design 7a v1, change `add-admin-channel-queues`) só conta o que existe:
contadores por canal, atividade recente e prazos. Ela não responde a pergunta que o operador faz
ao abrir o painel: "o que eu faço agora?". O design 7a v2 ("mesa de trabalho") reorienta a tela
para ação — cada item já chega com o próximo passo, a busca por protocolo/CPF/nome deixa de ser
uma caça por fila, e o que está acontecendo agora (chat, agenda do dia) fica visível sem trocar
de tela.

## What Changes

- **Redesign da tela `/admin` (Visão geral)** conforme o design "7a v2" do projeto
  `Redesign 07 - Admin Visão Geral, Agenda, Ouvidoria e LGPD`:
  - Cabeçalho com saudação (existente), campo de busca global e data.
  - **Linha de atalhos de ação**: "Novo pedido no balcão" (tecla N), "Confirmar horário" (com
    contagem de pendentes) e "Nova publicação". Somente ações cuja funcionalidade já existe —
    mesma regra da navegação: link que não leva a lugar nenhum é pior que link ausente.
  - **"Sua mesa hoje"**: fila unificada dos quatro canais (REQ, SOL, OUV, AGD) ordenada por
    urgência, cada item com chip de urgência ("vence em 3d", "há 2h", "para hoje", "novo") e o
    próximo passo como botão-link para o detalhe correspondente.
  - **"Agenda de hoje"**: compromissos do dia com destaque para o próximo, e link para a agenda.
  - **"Acontecendo agora"**: cidadão aguardando no chat (com o polling já existente do
    atendimento), com ação "Assumir conversa"; oculto quando o chat está desabilitado.
  - **"Continuar de onde parou"**: último item que o próprio usuário tocou (via `audit_log`).
  - **"Situação dos canais"**: os contadores grandes viram lista compacta, mantendo os links e o
    gating por permissão.
  - Cartão de **atalhos de teclado** documentando os atalhos disponíveis.
  - Os blocos "Atividade recente" e o formato antigo de "Prazos a acompanhar" saem da tela; os
    prazos passam a viver dentro de "Sua mesa hoje" como os itens mais urgentes.
- **Busca global (Ctrl K)**: overlay disponível em qualquer tela do painel, busca por protocolo,
  CPF ou nome do interessado nos quatro canais e leva ao detalhe do item; a camada de dados passa
  a buscar também por CPF.
- **Atalhos de teclado do painel**: `Ctrl K` (busca), `G P` (Pedidos), `G A` (Agenda), `N` (novo
  pedido no balcão), ativos em todo o painel e inertes dentro de campos de texto.

## Capabilities

### New Capabilities

- `admin-global-search`: busca global do painel por protocolo, CPF ou nome, disponível de
  qualquer tela via overlay (Ctrl K), roteando cada resultado para o detalhe na fila
  correspondente.

### Modified Capabilities

- `admin-overview`: os requirements de contadores, atividade recente e prazos são substituídos
  pela mesa de trabalho (atalhos de ação, mesa unificada por urgência, agenda do dia, chat ao
  vivo, continuar de onde parou, situação dos canais).
- `admin-shell`: a casca do painel ganha atalhos de teclado globais (Ctrl K, G P, G A, N).

## Impact

- `src/app/admin/(dashboard)/page.tsx`: reescrita da Visão geral (+ novos componentes em
  `_components/`).
- `src/lib/admin-overview.ts`: novas consultas (mesa unificada, agenda do dia, retomada por
  usuário); as de atividade recente permanecem para o "Continuar de onde parou".
- `src/lib/service-request.ts`: busca passa a incluir CPF; nova consulta de busca global.
- `src/core/`: lógica pura de ordenação por urgência da mesa e de interpretação do termo de
  busca (protocolo vs CPF vs nome), com testes `node --test`.
- `src/app/admin/(dashboard)/layout.tsx` + novo client component: overlay de busca e atalhos de
  teclado (atenção à CSP com nonce — sem script inline).
- `src/app/globals.css`: eventuais tokens novos no `@theme` (nenhum hex fora dele;
  `pnpm check:tokens`).
- `e2e/admin-overview.spec.ts`: reescrito para a mesa de trabalho; novo e2e de busca global.
- Pré-requisito já executado nesta proposta: spec `admin-overview` sincronizado do change
  `add-admin-channel-queues` para `openspec/specs/admin-overview/spec.md`.

## Não-objetivos

- **Modelos de exigência** e **bloquear agenda** (atalhos previstos no design): as
  funcionalidades não existem no produto; os atalhos correspondentes ficam de fora até que
  existam como changes próprios.
- **Atribuição de itens a um operador**: "Sua mesa hoje" é a mesa da serventia (itens em aberto
  dos canais), não uma fila pessoal por responsável — o modelo de dados não tem atribuição de
  responsável e este change não a cria.
- **Realtime por websocket**: o card "Acontecendo agora" usa o polling existente do atendimento.
- **Índices de busca / trigram**: a busca global usa `ilike` como as filas; otimização fica para
  quando houver volume.
- **Mudanças nas filas 7b/7c/7d** (`/admin/agenda`, `/admin/ouvidoria`, `/admin/lgpd`) e no site
  público.
- **Tecla N criando pedido de outra forma**: N apenas navega para `/admin/pedidos/novo`.

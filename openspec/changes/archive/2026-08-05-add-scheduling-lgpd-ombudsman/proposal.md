# Proposta: Agendar, Canal LGPD e Ouvidoria (Entrega 3 de 9)

## Why

As três seções institucionais já aparecem na navegação do site público, mas caem em
`ComingSoon`: o cidadão vê que a serventia agenda, atende pedido de titular de dados e recebe
manifestação — e não consegue fazer nenhuma das três pelo site. O redesign aprovado no Claude
Design ("Redesign 03 - Agendar, LGPD e Ouvidoria", projeto
`558c4556-caed-4f30-9c6b-648f995805cf`) fecha os três formulários curtos com o vocabulário já
estabelecido nas Entregas 1 e 2: escolha visível no lugar de controle nativo, garantia antes do
formulário, protocolo com chave de acesso e a mesma consulta para acompanhar.

O problema que o design resolve, em uma frase por fluxo: o agendamento hoje usa campo de data
nativo em formato americano e select de horário que não diz o que está livre; o canal LGPD pede
que o titular escolha o "tipo de solicitação" pelo nome jurídico e só mostra o prazo legal
depois do envio; a ouvidoria esconde as garantias de anonimato e sigilo abaixo do formulário no
celular.

## What Changes

- **Agendar (`/agendar`)**: dia vira faixa de dias úteis em chips (sem fim de semana e sem
  feriado nacional), horário vira faixa de uma hora com estado explícito (livre / escolhida /
  ocupada), e o aviso "isto é um pedido, a serventia confirma" desce para junto do botão. Estado
  de dia lotado com atalho para o próximo dia com vaga, e nada é enviado sem faixa escolhida.
  Confirmação com protocolo `AGD` + chave, e arquivo `.ics` para o botão "Adicionar à agenda".
- **Canal LGPD (`/lgpd`)**: os direitos do titular viram escolha em primeira pessoa ("Ver quais
  dados vocês têm sobre mim") com o nome jurídico como subtítulo; o prazo legal de 15 dias é
  declarado antes do envio; o cartão do DPO vira linha compacta no celular e coluna lateral no
  desktop. Confirmação com protocolo `SOL` + chave, prazo de resposta calculado e recibo em PDF.
- **Ouvidoria (`/ouvidoria`)**: garantias (pode ser anônima, sigilo garantido) sobem para antes
  do formulário; tipo de manifestação vira quatro cartões (elogio, reclamação, sugestão,
  denúncia); nome e contato explicitamente opcionais, com a diferença entre **anônimo** e
  **sigiloso** dita em uma frase. Confirmação com número de registro `OUV`; **manifestação
  anônima não recebe chave** — sem identificação não há dado a proteger nem canal de resposta.
- **Consulta (`/protocolo`)**: passa a atender os quatro prefixos com o mesmo formulário e a
  mesma chave. O detalhe rende por tipo: `AGD` com o horário pedido, o horário proposto pela
  serventia e os botões aceitar / pedir outro; `SOL` com a resposta do Encarregado e o prazo
  legal cumprido; `OUV` com o histórico do tratamento e a resposta. Andamento derivado das datas
  do próprio registro, sem tabela de eventos.
- **Núcleo e banco**: `service_requests` ganha discriminador `kind` (pedido, agendamento, LGPD,
  ouvidoria) e sequência de protocolo por (serventia, tipo, ano) — hoje é por (serventia, ano).
  Os campos que não valem para todos os tipos (ato, atribuição, nome, contato, chave) passam a
  aceitar nulo, e o que é específico de cada canal vai para uma coluna `details` em JSONB.
  Anexos, chave de acesso, rate limit, honeypot, auditoria e upload são reaproveitados sem
  mudança.
- **Configuração da serventia**: o `Tenant` ganha a janela de atendimento em forma estruturada
  (hora de início, hora de fim, quantos atendimentos cabem por faixa), hoje só existente como
  frase (`openingHours`). A frase continua sendo o que o cidadão lê.

## Capabilities

### New Capabilities

- `appointment-scheduling`: pedido de horário para atendimento presencial — dias úteis
  disponíveis, faixas de uma hora com ocupação real, protocolo `AGD` com chave, `.ics`, estado
  de dia lotado e aceite do horário proposto na consulta.
- `data-rights-channel`: canal do Encarregado de Dados — direitos em linguagem de titular, prazo
  legal de 15 dias declarado antes do envio, protocolo `SOL` com chave, recibo em PDF e leitura
  da resposta do DPO protegida por chave.
- `ombudsman-channel`: ouvidoria — garantias antes do formulário, quatro tipos de manifestação,
  identificação opcional, distinção entre anônimo e sigiloso, registro `OUV` (com chave apenas
  quando identificada) e histórico do tratamento na consulta.

### Modified Capabilities

(nenhuma — `openspec/specs/` ainda não tem specs sincronizadas; o que muda em pedido de serviço
e consulta é numeração e leitura, descritas nas specs novas acima)

## Não-objetivos

- **Painel admin dos três canais** (fila de agendamentos, propor outro horário, responder ao
  titular, tratar manifestação) — Entrega 6. Esta entrega grava os campos que o admin vai
  escrever e renderiza os estados resultantes na consulta do cidadão; quem escreve ainda é
  migração/seed em teste.
- **Envio de notificação** por e-mail ou WhatsApp ("chega pelo WhatsApp informado"). O texto
  descreve o que a serventia faz hoje pelos canais dela; disparo automático é entrega própria.
- **Agenda com reserva firme**: a faixa escolhida não é bloqueada no ato. O pedido é pedido — a
  serventia confirma. A ocupação mostrada é a contagem de pedidos vivos na faixa, não uma
  reserva.
- **Calendário de feriados municipais/estaduais e recessos da serventia**: só os feriados
  nacionais (fixos e móveis) saem da lista. Ponto facultativo e feriado local ficam para quando
  houver onde a serventia cadastrar.
- **Chat de atendimento** ("Falar no chat" no estado de dia lotado) — Entrega 8; o botão aponta
  para o WhatsApp da serventia até lá.
- **Anexo na resposta do DPO** (relatório de dados pessoais gerado pela serventia) — depende do
  admin, Entrega 6.
- **Fluxo de "Complementar" e "Responder ao DPO"** a partir da consulta: reaproveita o envio de
  documento que já existe na consulta; não nasce um canal de mensagens nesta entrega.

## Impact

- `src/core/`: `scheduling/` novo (dias úteis com feriados nacionais móveis, faixas de horário,
  disponibilidade) e `request/` estendido (schemas Zod dos três formulários, tipos de canal,
  prazo legal LGPD) — tudo puro, com `node --test`.
- `src/db/schema.ts` + migração expand-only: coluna `kind`, coluna `details` (JSONB), colunas de
  resposta da serventia, afrouxamento de `NOT NULL` nos campos que não valem para todo canal e
  troca do índice único de sequência para (serventia, tipo, ano, sequência).
- `src/lib/service-request.ts`: criação e consulta passam a receber o tipo de canal; nasce a
  contagem de ocupação por dia/faixa.
- `src/app/(public)/`: `agendar/`, `lgpd/` e `ouvidoria/` deixam de ser `ComingSoon` e ganham
  formulário, server action e tela de confirmação; `protocolo/` passa a renderizar por tipo;
  rota nova do `.ics` e do recibo LGPD em PDF.
- `src/core/tenant/schema.ts` e os dois tenants: janela de atendimento estruturada.
- E2E Playwright (mobile 390 primeiro): agendar até a confirmação, LGPD até a confirmação,
  ouvidoria anônima (sem chave) e ouvidoria identificada com sigilo (com chave), e consulta de
  cada protocolo.
- Sem dependência nova: `.ics` é texto, o PDF usa o `pdfkit` já instalado, os feriados móveis
  saem de aritmética no núcleo.

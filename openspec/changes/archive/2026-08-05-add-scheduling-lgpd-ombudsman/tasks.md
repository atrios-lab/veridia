# Tarefas: Agendar, Canal LGPD e Ouvidoria

## 1. Núcleo: calendário e faixas de horário (appointment-scheduling)

- [x] 1.1 `src/core/scheduling/calendar.ts`: feriados nacionais fixos + móveis (Páscoa por
      Meeus/Butcher: carnaval −48, sexta-feira santa −2, Corpus Christi +60), `isBusinessDay`,
      `nextBusinessDays(fromIsoDate, count)` — puro, datas como `YYYY-MM-DD`
- [x] 1.2 `src/core/scheduling/slots.ts`: faixas de uma hora a partir da janela da serventia,
      rótulo (`8h — 9h`), estado por faixa (`free` | `taken`) dada a contagem de ocupação, e
      `nextDayWithSlot` para o estado de dia lotado
- [x] 1.3 Rótulos em português de dia da semana e mês abreviados (`qua`, `ago`) no núcleo, sem
      depender do locale do servidor
- [x] 1.4 `node --test` de 1.1–1.3: fim de semana e feriado fora, Páscoa conferida em três anos,
      faixa ocupada ao atingir capacidade, dia lotado apontando o próximo dia livre

## 2. Núcleo: formulários e tipos dos três canais

- [x] 2.1 `src/core/request/kinds.ts`: tipos de registro (`service-request`, `appointment`,
      `data-rights`, `ombudsman`), mapa para `PROTOCOL_PREFIXES`, rótulos de status por tipo
- [x] 2.2 Schemas Zod dos três formulários em `src/core/request/`: agendamento (dia, faixa, nome,
      contato, motivo opcional), LGPD (direito, nome, e-mail, CPF opcional, descrição, declaração
      obrigatória) e ouvidoria (tipo, mensagem, nome/contato opcionais, sigilo) — reutilizando
      `isValidContact`, `isValidCpf` e os formatadores já existentes
- [x] 2.3 Catálogo dos direitos do titular (rótulo em primeira pessoa + nome jurídico +
      consequência) e dos tipos de manifestação (rótulo + ícone), como dados no núcleo
- [x] 2.4 Prazo legal LGPD: `deadlineFor(createdAt)` (15 dias) e `dayOfDeadline`, puros
- [x] 2.5 `src/core/scheduling/ics.ts`: montagem do `VCALENDAR`/`VEVENT` como texto, com escape
- [x] 2.6 `node --test` de 2.2–2.5: obrigatoriedades por canal, anônimo sem nome/contato válido,
      data limite e dia do prazo, `.ics` com dia e faixa corretos

## 3. Banco (expand-only)

- [x] 3.1 `src/db/schema.ts`: colunas `kind` (default `service-request`), `details` (JSONB),
      `office_reply`, `office_replied_at`; `act_id`, `attribution`, `applicant_name`, `contact` e
      `access_key_hash` passam a aceitar nulo
- [x] 3.2 Índice único de sequência passa a `(tenant, kind, ano, sequência)`; mantido o único de
      `(tenant, protocol_number)`
- [x] 3.3 Migração Drizzle gerada e conferida como expand-only (nada removido ou renomeado)
- [x] 3.4 Teste de banco: criação de um registro de cada canal, sequência independente por tipo no
      mesmo ano, e ouvidoria anônima gravada sem nome, contato e chave

## 4. Persistência e disponibilidade

- [x] 4.1 `src/lib/service-request.ts`: criação passa a receber o tipo do canal e `details`, com a
      mesma estratégia de sequência com retry em conflito; auditoria por tipo
      (`appointment.create`, `data-rights.create`, `ombudsman.create`)
- [x] 4.2 Contagem de ocupação por dia e faixa (agendamentos vivos: `requested`, `proposed`,
      `confirmed`), usada pela página e revalidada no envio
- [x] 4.3 Leitura de `details` sempre por schema Zod do núcleo, na escrita e na leitura

## 5. Agendar (`/agendar`)

- [x] 5.1 Página Server Component: contexto (janela de atendimento, motivo livre), dias úteis em
      chips com o dia escolhido na URL, faixas com estado real, e coluna lateral no desktop
      ("Como funciona" em 3 passos + atalho para Solicitar serviço)
- [x] 5.2 Formulário Client Component (RHF + `zodResolver` do schema do núcleo), aviso de "isto é
      um pedido" imediatamente antes do botão, honeypot invisível
- [x] 5.3 Estado de dia lotado: bloco "Este dia está cheio", próximo dia com vaga, atalho para ele
      e contato da serventia (WhatsApp no lugar do chat até a Entrega 8); envio bloqueado sem faixa
- [x] 5.4 Server Action: rate limit → honeypot → Zod → revalidação da faixa → gravação `AGD`;
      faixa fechada devolve erro com o próximo dia livre
- [x] 5.5 Tela de confirmação: dia e faixa pedidos, `ProtocolReveal` com protocolo e chave, os dois
      cartões de expectativa, "Acompanhar pelo protocolo" e "Adicionar à agenda"
- [x] 5.6 Rota `POST` do `.ics` exigindo protocolo e chave, resposta `private, no-store`

## 6. Canal LGPD (`/lgpd`)

- [x] 6.1 Página: introdução com o prazo de 15 dias, DPO da configuração (linha compacta no
      celular, cartão lateral no desktop com art. 41 §3 e link da política de privacidade),
      direitos como escolha única com nome jurídico e consequência no subtítulo
- [x] 6.2 Formulário Client Component: nome, e-mail, CPF opcional com máscara, descrição, anexo
      opcional (identidade/procuração) e declaração de titularidade obrigatória; honeypot
- [x] 6.3 Server Action: rate limit → honeypot → Zod → anexos → gravação `SOL` com o direito em
      `details`
- [x] 6.4 Confirmação: direito escolhido, `ProtocolReveal`, data limite calculada com barra de
      prazo ("dia 1 de 15"), aviso de possível comprovação de titularidade, acompanhar e recibo
- [x] 6.5 Rota `POST` do recibo em PDF (pdfkit, reaproveitando a montagem pura do núcleo), exigindo
      protocolo e chave

## 7. Ouvidoria (`/ouvidoria`)

- [x] 7.1 Página: garantias (anônima, sigilo, resposta pelos canais oficiais) antes do formulário
      no celular e em coluna lateral no desktop
- [x] 7.2 Formulário: quatro cartões de tipo com ícone, mensagem obrigatória, nome e contato
      rotulados como opcionais, anexo opcional, opção de sigilo com a frase que a distingue do
      anonimato; honeypot
- [x] 7.3 Server Action: rate limit → honeypot → Zod → anexos → gravação `OUV`; chave gerada apenas
      quando há identificação
- [x] 7.4 Confirmação anônima: apenas o número de registro, a explicação de por que não há chave e
      o caminho para ter resposta
- [x] 7.5 Confirmação identificada: `ProtocolReveal`, efeito do sigilo e "O que acontece agora"

## 8. Consulta por protocolo (`/protocolo`)

- [x] 8.1 `ProtocolReveal` extraído para `(public)/_components/` e adotado também pelo `/solicitar`
- [x] 8.2 Action de consulta devolve union discriminado por tipo; rótulos de status por canal
- [x] 8.3 Detalhe `AGD`: horário pedido, bloco "É a sua vez" com comparação pedido × proposto,
      aceitar / pedir outro, andamento derivado das datas do registro
- [x] 8.4 Action de aceite da proposta (protocolo + chave), gravando o novo horário e o aceite
- [x] 8.5 Detalhe `SOL`: resposta do Encarregado com autor e data, aviso de que a resposta só
      aparece com protocolo e chave, andamento com o dia do prazo legal
- [x] 8.6 Detalhe `OUV`: tipo, marca de sigilo, resposta da ouvidoria, histórico do tratamento e a
      afirmação de que o nome não apareceu nas etapas exibidas

## 9. Configuração da serventia

- [x] 9.1 `Tenant` ganha `scheduling: { startHour, endHour, capacityPerSlot }` com default 8/14/2
- [x] 9.2 Os dois tenants configurados declaram a janela; `openingHours` segue como a frase lida
- [x] 9.3 Remover os `ComingSoon` das três seções; navegação e gating conferidos sem mudança

## 10. Verificação

- [x] 10.1 E2E Playwright mobile (390px): agendar → confirmação com protocolo e chave → `.ics`;
      dia lotado sem botão de envio
- [x] 10.2 E2E: LGPD → confirmação com data limite → recibo em PDF; e declaração não marcada
      bloqueando o envio
- [x] 10.3 E2E: ouvidoria anônima (sem chave) e identificada com sigilo (com chave)
- [x] 10.4 E2E: consulta de `AGD` com horário proposto (registro semeado), aceite, e consulta de
      `SOL` respondida
- [x] 10.5 Conferir os dois tenants no dev (mesma estrutura, marcas distintas);
      `pnpm biome check`, `node --test` e build limpos

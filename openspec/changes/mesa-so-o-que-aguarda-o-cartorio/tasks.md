## 1. Regra no núcleo

- [x] 1.1 Adicionar `awaitingOffice: boolean` a `DeskItemInput` em `src/core/overview/desk.ts`,
      documentando que a vez é da serventia quando a última ação do cidadão é mais recente que a
      última da serventia.
- [x] 1.2 Filtrar por `awaitingOffice` em `rankDeskItems`, antes da ordenação e do corte de 6,
      mantendo intactos os tiers e os desempates atuais.
- [x] 1.3 Manter na mesa o requerimento LGPD perto do prazo ou vencido mesmo com
      `awaitingOffice` falso, reusando o tier 1 já calculado por `dataRightsUrgency`.
- [x] 1.4 Deixar `countCriticalDeskItems` operando sobre o conjunto completo, sem filtro.
- [x] 1.5 Cobrir em `src/core/overview/desk.test.ts`, no estilo `node --test` do arquivo: item
      que aguarda a serventia entra; item que aguarda o cidadão fica de fora; LGPD no prazo
      crítico permanece mesmo aguardando o cidadão; ordenação atual preservada entre os que
      ficam.

## 2. Sinal vindo do banco

- [x] 2.1 Em `src/lib/admin-overview.ts`, escrever a consulta de última ação da serventia:
      `max(created_at)` por registro em `audit_log` com `actor_id` preenchido, restrita aos ids
      abertos, casando `target_id` tanto com `id::text` quanto com `protocol_number` (mesmo
      cuidado de `listRecentActivity`).
- [x] 2.2 Restringir a consulta às ações que devolvem o registro ao cidadão, por lista de
      inclusão: escrituração de balcão (`amount`, `key-reissue`) e trabalho não enviado
      (`draft`, `internal-note`) ficam de fora, com o motivo em comentário.
- [x] 2.3 Escrever a consulta de última mensagem do cidadão: `max(created_at)` em
      `service_request_requirement_messages` com `author = 'citizen'`, agrupado por
      `service_request_requirements.request_id`, restrita aos mesmos ids.
- [x] 2.4 Calcular `awaitingOffice` em `listDeskItems`: `lastCitizenAt` é o maior entre
      `createdAt` do registro e a última mensagem do cidadão; sem ação da serventia, a vez é
      dela. Expor o campo em `DeskRecord`.
- [x] 2.5 Conferir que as duas consultas partem dos ids já buscados, sem varrer a auditoria
      inteira do tenant.

## 3. Painel

- [x] 3.1 Repassar `awaitingOffice` de `DeskRecord` para `DeskItemInput` em
      `src/app/admin/(dashboard)/page.tsx`.
- [x] 3.2 Fazer o aviso de "mais N itens" contar apenas os itens que aguardam a serventia, para
      não anunciar um número que a mesa nunca mostraria.
- [x] 3.3 Reescrever o estado vazio em `_components/desk-list.tsx`: dizer que nada aguarda a
      serventia, com link para `/admin/pedidos`, sem afirmar que não há itens em aberto.

## 4. Verificação

- [x] 4.1 Rodar `node --test` do núcleo e o lint/format do projeto.
- [x] 4.2 Atualizar `e2e/admin-overview.spec.ts` para os novos cenários, sem executar a suíte
      contra o banco compartilhado; deixar a execução para quem tiver ambiente isolado.
- [ ] 4.3 Conferir no painel, com o host de um cartório real e não em localhost puro, que um
      pedido respondido sai da mesa e volta quando o cidadão escreve na exigência.
- [ ] 4.4 Rodar `openspec validate mesa-so-o-que-aguarda-o-cartorio` e abrir PR a partir do
      branch `mesa-so-o-que-aguarda-o-cartorio`.

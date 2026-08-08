## 1. Núcleo e camada de dados compartilhados

- [x] 1.1 `src/core/request/kinds.ts`: `TERMINAL_STATUSES: Record<RequestKind, readonly string[]>`
      (service-request aponta pro array já existente; appointment = `["done","cancelled"]`;
      ombudsman = `["answered","done"]`; data-rights = `["answered","cancelled"]`) e
      `isOpenStatus(kind, status)`.
- [x] 1.2 `src/core/request/kinds.ts`: `ombudsmanDetailsSchema` ganha `draftReply` e
      `internalNote` opcionais; `dataRightsDetailsSchema` ganha `draftReply` opcional;
      `appointmentDetailsSchema` já tem os campos de proposta (nenhuma mudança).
- [x] 1.3 `src/core/auth/roles.ts`: permissão `channels.manage`, concedida a `admin` e `staff`.
- [x] 1.4 `src/core/request/kinds.test.ts`: cobrir `TERMINAL_STATUSES`/`isOpenStatus` pros quatro
      `kind`s e o parse dos campos novos de `details`.
- [x] 1.5 `src/lib/service-request.ts`: `listRecordsByKind(tenantSlug, kind, {status?, search?})`
      — mesmo padrão de `listServiceRequests`, sem filtro de atribuição.
- [x] 1.6 `src/lib/service-request.ts`: `openCountByKind(tenantSlug, kind)` usando
      `TERMINAL_STATUSES[kind]`.
- [x] 1.7 `src/lib/service-request.ts`: `listRecordHistory(tenantSlug, kind, id, protocolNumber)`
      — generaliza `listRequestHistory` para `targetType` variável.
- [x] 1.8 `src/lib/service-request.ts`: `respondToRecord(tenantSlug, id, {reply, attachments?},
      actorId)` — grava `officeReply`/`officeRepliedAt`, muda `status` para o valor "respondido"
      do `kind` (parâmetro), limpa `draftReply` de `details`, audita.
- [x] 1.9 `src/db/service-request.test.ts`: cobrir as seis funções acima (PGlite) para os três
      `kind`s novos.
- [x] 1.10 `src/app/admin/_components/icon.tsx`: ícones novos — calendário (Agenda), megafone
      (Ouvidoria), escudo (LGPD) — mesmo estilo `path`-only dos existentes.

## 2. Requerimentos LGPD — fila e detalhe [7d]

- [x] 2.1 `src/app/admin/(dashboard)/lgpd/page.tsx`: fila via `listRecordsByKind(tenantSlug,
      "data-rights", ...)`, checagem de `channels.manage`; cada linha com protocolo, titular e
      indicador de prazo (`dataRightsDeadline`/`dataRightsDayOfDeadline`) — "Vence em N dias"
      (≤3 dias, `status = "new"`), "Prazo vencido há N dias" (passado o prazo), ou a situação.
- [x] 2.2 `src/app/admin/(dashboard)/lgpd/[protocolo]/page.tsx`: direito solicitado por extenso
      (`dataRightOption`), descrição do titular, nome/contato, anexo de identidade
      (`listAttachments`, `kind: "citizen"`), prazo com data limite e dia do prazo, histórico
      (`listRecordHistory`).
- [x] 2.3 `src/app/admin/(dashboard)/lgpd/[protocolo]/actions.ts`: `respondDataRights(reply,
      attachment?)` (chama `respondToRecord` + `attachToRequest` com `kind: "office"` se houver
      anexo) e `saveDataRightsDraft(reply)` (grava só `details.draftReply` via `updateDetails`).
- [x] 2.4 `HISTORY_LABELS`-equivalente para `data-rights` (ex.: `"data-rights.respond": "respondeu
      ao titular"`, `"data-rights.draft": "salvou um rascunho de resposta"`).
- [x] 2.5 `e2e/admin-lgpd.spec.ts`: fila mostrando prazo a vencer e vencido, abrir detalhe,
      responder e conferir que a consulta pública (`/protocolo`) passa a mostrar a resposta,
      salvar rascunho e conferir que não aparece na consulta pública.

## 3. Ouvidoria — fila e detalhe [7c]

- [x] 3.1 `src/app/admin/(dashboard)/ouvidoria/page.tsx`: fila via `listRecordsByKind(tenantSlug,
      "ombudsman", ...)`; cada linha com protocolo, tipo (`manifestationLabel`), situação, e
      identificada/anônima/sob sigilo (`isAnonymous`-equivalente sobre os dados já lidos,
      `confidential`).
- [x] 3.2 `src/app/admin/(dashboard)/ouvidoria/[protocolo]/page.tsx`: texto da manifestação, tipo,
      nome/contato quando existem, histórico. Quando `applicantName`/`contact` ausentes: aviso
      explícito de que não há como responder, e nenhum formulário de resposta.
- [x] 3.3 `src/app/admin/(dashboard)/ouvidoria/[protocolo]/actions.ts`: `respondManifestation
      (reply)` e `saveManifestationDraft(reply)` (só quando há contato); `saveInternalNote(note)`
      (só quando não há contato) grava `details.internalNote` via `updateDetails`, sem tocar
      `officeReply`.
- [x] 3.4 `HISTORY_LABELS`-equivalente para `ombudsman` (`"ombudsman.respond"`,
      `"ombudsman.draft"`, `"ombudsman.internal-note"`).
- [x] 3.5 `e2e/admin-ombudsman.spec.ts`: fila distinguindo identificada/anônima, responder uma
      identificada e conferir que a consulta por número de registro mostra a resposta, abrir uma
      anônima sem contato e conferir que não há formulário de resposta, só anotação interna.

## 4. Agenda de atendimentos — fila e detalhe [7b]

- [x] 4.1 `src/app/admin/(dashboard)/agenda/page.tsx`: fila via `listRecordsByKind(tenantSlug,
      "appointment", ...)`; cada linha com protocolo, status (`statusLabel`), solicitante, faixa
      pedida (`date`/`slotHour` de `details`).
- [x] 4.2 `src/app/admin/(dashboard)/agenda/[protocolo]/page.tsx`: solicitante, contato, assunto,
      faixa pedida, faixa proposta quando houver, histórico.
- [x] 4.3 Componente de seleção de faixa livre para "Propor outro horário", reaproveitando
      `appointmentOccupancy` (mesma lógica de faixa livre do formulário público, apresentação
      própria do admin).
- [x] 4.4 `src/app/admin/(dashboard)/agenda/[protocolo]/actions.ts`: `confirmAppointment`,
      `proposeAppointmentSlot(date, slotHour)` (grava `proposedDate`/`proposedSlotHour`/
      `proposedAt`, `status = "proposed"`), `cancelAppointment`, `markAppointmentAttended`.
- [x] 4.5 `HISTORY_LABELS`-equivalente para `appointment` (`"appointment.confirm"`,
      `"appointment.propose"`, `"appointment.cancel"`, `"appointment.attend"`).
- [x] 4.6 `e2e/admin-agenda.spec.ts`: fila com os quatro status, confirmar um pedido, propor outro
      horário e conferir que a consulta pública (`/protocolo`) oferece aceitar a proposta
      (`acceptProposedSlot` já existe do lado público), cancelar, marcar como atendido.

## 5. Visão geral [7a]

- [x] 5.1 `src/lib/service-request.ts` (ou novo `src/lib/admin-overview.ts`): `listRecentActivity
      (tenantSlug, kinds, limit)` — join de `audit_log` com `serviceRequests` por `id` OU
      `protocolNumber`, escopado à tenant e aos `kind`s permitidos, mais recente primeiro.
- [x] 5.2 Mapa `action → (applicantName, protocolNumber) => string` (sentença em português) ao
      lado das actions que o gera, com fallback genérico para ação sem entrada no mapa.
- [x] 5.3 `listUpcomingDataRightsDeadlines(tenantSlug)` — `kind = "data-rights"`,
      `status = "new"`, `dataRightsDeadline - hoje <= 3 dias` (inclui vencidos).
- [x] 5.4 `listStalledFulfilledRequirements(tenantSlug)` — `kind = "service-request"`,
      `status = "in-review"`, existe exigência `fulfilled` e nenhuma `pending`.
- [x] 5.5 `src/app/admin/(dashboard)/page.tsx`: reescreve o placeholder — cartões por canal
      (contagem via `openCountByKind`/`openRequestCount`, omitindo o que a sessão não pode
      operar), bloco de atividade recente, bloco de prazos a acompanhar (5.3 + 5.4), estado vazio
      explícito quando não há prazos.
- [x] 5.6 `e2e` (pode ficar em `e2e/admin-service-requests.spec.ts` ou arquivo próprio): Visão
      geral mostra contadores corretos, um evento de cada canal aparece na atividade recente com
      link funcionando, requerimento LGPD perto do vencimento aparece nos prazos a acompanhar.

## 6. Navegação e revisão final

- [x] 6.1 `src/app/admin/_components/nav.ts`: itens "Requerimentos LGPD" (`/admin/lgpd`, ícone
      escudo), "Ouvidoria" (`/admin/ouvidoria`, ícone megafone), "Agenda de atendimentos"
      (`/admin/agenda`, ícone calendário), grupo "Operação", permissão `channels.manage`.
- [x] 6.2 `src/app/admin/(dashboard)/layout.tsx`: computa `openCountByKind` para os três `kind`s
      novos (só quando `channels.manage`) e repassa junto de `openRequestCount` no `counts`.
- [x] 6.3 Conferir que nenhuma cor sai de `--color-admin-*`/`--brand-*` nas telas novas.
- [x] 6.4 `openspec validate add-admin-channel-queues --strict` antes do archive.

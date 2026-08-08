## Context

As quatro telas já existem do lado do cidadão (`/agendar`, `/ouvidoria`, `/lgpd`, e a consulta
`/protocolo`) e gravam num único registro, `serviceRequests`, diferenciado por `kind`
(`"appointment" | "ombudsman" | "data-rights"`, além de `"service-request"`). O painel só opera
`kind = "service-request"` hoje (`/admin/pedidos`, Entrega 6). Este change abre os outros três
`kind`s para o operador, na mesma tabela, e substitui o placeholder de `/admin`.

`add-admin-service-requests` ainda não foi arquivado (`openspec/changes/add-admin-service-requests/`
sem estar em `changes/archive/`) — este design constrói em cima das suas delta specs
(`admin-shell`, `service-request`), não do `openspec/specs/` base, que está desatualizado até lá.

Peças já prontas que este change reaproveita sem alterar:
- `src/core/request/kinds.ts`: `STATUS_LABELS` de `appointment`/`ombudsman`/`data-rights`,
  `LIVE_APPOINTMENT_STATUSES`, `parseDetails`.
- `src/core/request/channels.ts`: `DATA_RIGHTS_DEADLINE_DAYS`, `dataRightsDeadline`,
  `dataRightsDayOfDeadline`, `manifestationLabel`, `dataRightOption`.
- `src/lib/service-request.ts`: `createRecord` (o `citizen`-kind attachment de identidade do LGPD
  já é gravado por ela), `updateDetails`, `listAttachments`, `appointmentOccupancy`,
  `findByProtocol`.
- `src/app/(public)/protocolo/actions.ts`: já lê `officeReply`/`officeRepliedAt` para
  `data-rights` e `ombudsman`, e já tem `acceptProposedSlot` — o cidadão aceitando o horário
  proposto pelo operador já está implementado do lado público. Este change só precisa escrever
  os campos que essa tela já lê.

## Goals / Non-Goals

**Goals:**
- As quatro telas do design (7a–7d) com dado real, seguindo a ordem de implementação pedida:
  LGPD primeiro (tem prazo legal), depois Ouvidoria, Agenda, Visão geral por último.
- Reaproveitar a tabela `serviceRequests` e o vocabulário de `kinds.ts` sem duplicar schema —
  cada canal novo é uma fila filtrada por `kind`, no mesmo padrão que `listServiceRequests` já
  estabelece para `service-request`.
- Fechar o ciclo de resposta pelos mesmos dois campos que a consulta pública já lê
  (`officeReply`/`officeRepliedAt`), sem inventar um segundo caminho de entrega.

**Non-Goals:**
- Notificação ativa por e-mail/WhatsApp (ver proposal.md — Non-Goals).
- Papel de DPO/ouvidor distinto do modelo `admin`/`staff` atual.
- Calendário de agenda por dia/semana — só lista + detalhe.
- Máquina de estados imposta no banco para os três `kind`s novos — mesmo padrão de
  `service-request`: o núcleo valida contra a lista fechada de valores, a curadoria de transição
  fica na UI/Server Action.

## Decisions

### Uma permissão só, `channels.manage`, para os três canais novos

O design não distingue "encarregado(a)" de "ouvidor(a)" de "operador(a)" como papéis diferentes —
são rótulos da história de usuário, não do login. Seguindo o mesmo raciocínio que deu
`requests.manage` a `admin` e `staff` (é trabalho de operação, não configuração sensível),
`channels.manage` cobre Agenda, Ouvidoria e LGPD juntos, concedida aos dois papéis. Uma
permissão por canal (`scheduling.manage`, `ombudsman.manage`, `data-rights.manage`) foi
considerada e rejeitada: nada no produto hoje precisa conceder um canal sem os outros dois, e
três permissões que sempre andam juntas são só mais três strings pra manter sincronizadas.
`requests.manage` continua separada (pedidos de serviço é o canal com mais ação — exigência,
valor, entrega — e já existe como permissão própria).

### Fila genérica por `kind`, não três cópias de `listServiceRequests`

`listServiceRequests`/`openRequestCount` são específicas de `service-request` porque a tela de
pedidos tem filtro de atribuição que os outros três `kind`s não têm. Para agenda/ouvidoria/lgpd,
adiciono em `src/lib/service-request.ts`:

```ts
listRecordsByKind(tenantSlug, kind, { status?, search? })
openCountByKind(tenantSlug, kind)   // usa TERMINAL_STATUSES[kind] (ver abaixo)
listRecordHistory(tenantSlug, kind, id, protocolNumber)  // generaliza listRequestHistory,
                                                          // que hoje trava targetType em "service-request"
```

`listRequestHistory`/`openRequestCount`/`isOpenServiceRequestStatus` continuam existindo como hoje
(pedidos mantém seu próprio caminho, já testado); as três novas funções são a versão genérica que
as outras três telas chamam. Alternativa considerada: uma função `listRecordsByKind` cobrindo
inclusive `service-request` e aposentar `listServiceRequests`. Rejeitada agora — pedidos tem filtro
de atribuição que não existe nos outros `kind`s, e reescrever uma tela que já está em produção só
pra economizar uma função não paga o risco.

### `TERMINAL_STATUSES` e `isOpenStatus` em `kinds.ts`, por `kind`

Hoje só `service-request` tem `TERMINAL_SERVICE_REQUEST_STATUSES`/`isOpenServiceRequestStatus`.
Os outros três `kind`s precisam da mesma coisa pro contador da sidebar e da Visão geral:

| kind | Terminal (fora do contador) |
|---|---|
| `appointment` | `done`, `cancelled` (idêntico ao já existente `LIVE_APPOINTMENT_STATUSES`, invertido) |
| `ombudsman` | `answered`, `done` |
| `data-rights` | `answered`, `cancelled` |

Viram um único `TERMINAL_STATUSES: Record<RequestKind, readonly string[]>` (com
`"service-request"` apontando pro array que já existe) e `isOpenStatus(kind, status)`. É a mesma
forma que `STATUS_LABELS` já tem — um `Record<RequestKind, …>` — então generalizar aqui segue o
padrão já escolhido pro arquivo, não introduz um novo.

### Ações por botão, não um "mudar status" genérico, nas três telas novas

`/admin/pedidos` tem `changeStatus` genérico porque o andamento do pedido tem oito valores e um
`<select>` de correção manual. As três telas novas têm o design mostrando botões de ação
específicos (Confirmar / Propor outro horário / Cancelar / Enviar resposta e concluir / Salvar
rascunho), então cada uma vira uma Server Action própria, seguindo o padrão de
`[protocolo]/actions.ts` (`registerRequirementAction`, `setAmountAction`, etc. — uma função por
botão, `authorize()` privado repetido em cada uma):

- `src/app/admin/(dashboard)/agenda/[protocolo]/actions.ts`: `confirmAppointment`,
  `proposeAppointmentSlot(date, slotHour)`, `cancelAppointment`, `markAppointmentAttended`.
- `.../ouvidoria/[protocolo]/actions.ts`: `respondManifestation(reply)`,
  `saveManifestationDraft(reply)`, `saveInternalNote(note)`.
- `.../lgpd/[protocolo]/actions.ts`: `respondDataRights(reply, attachment?)`,
  `saveDataRightsDraft(reply)`.

`proposeAppointmentSlot` reaproveita `appointmentOccupancy` pro mesmo seletor de faixas livres do
formulário público (`src/app/(public)/agendar/appointment-form.tsx`) — extraio o seletor de
faixas num componente compartilhado (`src/core` continua puro; o componente React vive em algum
lugar comum aos dois route groups, ou é duplicado como o resto do painel já faz com ícones —
decisão de implementação, não de arquitetura: ver Open Questions).

### Rascunho e anotação interna vivem em `details`, nunca em `officeReply`

`officeReply`/`officeRepliedAt` são os dois campos que `/protocolo` já lê e mostra ao cidadão.
"Salvar rascunho" e a "anotação interna" da manifestação anônima sem contato não podem usar os
mesmos campos — vazariam pro cidadão assim que gravados, ou (no caso da anotação interna) não têm
pra quem vazar. Ambos ganham campo próprio em `details`, opcional, nunca lido por
`lookupProtocolDetail`:

```ts
// ombudsmanDetailsSchema ganha:
draftReply: z.string().optional(),
internalNote: z.string().optional(),
// dataRightsDetailsSchema ganha:
draftReply: z.string().optional(),
```

"Enviar resposta e concluir" grava `officeReply`/`officeRepliedAt`/`status` (e limpa `draftReply`,
pra não guardar duas cópias divergentes da mesma coisa). A UI de resposta pré-preenche o textarea
com `draftReply ?? ""`.

### Anexo de "relatório de dados" reaproveita `kind: "office"`

Mesmo rótulo interno que o documento final de entrega de pedido de serviço já usa em
`serviceRequestAttachments.kind`. Nenhuma migração, nenhum terceiro valor de `kind` de anexo.

### Visão geral: atividade recente via `audit_log`, sentença por `action`

`createRecord` já audita a criação de todo `kind` com `targetType: kind` (não
`"service-request"` fixo — conferido em `src/lib/service-request.ts`). A Visão geral lê as N
entradas mais recentes de `audit_log` da tenant (todos os `targetType`s), faz join em
`serviceRequests` por `id` OU `protocolNumber` (mesma ambiguidade que `listRequestHistory` já
resolve) pra recuperar `applicantName`/`protocolNumber`/`kind`, e usa um mapa
`action → (applicantName, protocolNumber) => string` pra montar a frase em português — mesma
ideia que `HISTORY_LABELS` do detalhe de pedido já é, só que produzindo frase completa em vez de
verbo solto (o detalhe já sabe de quem é a história; a Visão geral não).

Alternativa considerada: guardar a frase pronta na própria entrada de auditoria no momento da
escrita. Rejeitada — `audit_log` não tem coluna de texto livre por design (ver
`add-admin-service-requests/design.md`, decisão de exclusão auditada), e adicionar uma quebraria
esse invariante pra um único consumidor.

### Prazos a acompanhar: duas consultas específicas, sem tabela nova

- **LGPD perto de vencer**: `kind = 'data-rights' AND status = 'new'`, calculado em memória com
  `dataRightsDayOfDeadline`/`dataRightsDeadline` (já existem) — sem SQL de data, mesmo padrão que
  `/protocolo` já usa pro mesmo cálculo. Corte de "perto" é `dataRightsDeadline - hoje <= 3 dias`
  (mesmo horizonte que o cartão da Visão geral do design mostra, "vence em 3 dias").
- **Exigência cumprida aguardando retomada**: `kind = 'service-request' AND status = 'in-review'
  AND EXISTS (requirement fulfilled) AND NOT EXISTS (requirement pending)` — pedido cuja última
  exigência foi resolvida mas o operador ainda não moveu o andamento adiante.

## Risks / Trade-offs

- **Fila sem paginação** nos três canais novos → mesmo trade-off já aceito e documentado em
  `add-admin-service-requests`; mesma mitigação (adicionar quando o volume real pedir).
- **`channels.manage` como permissão única** → se um dia a serventia precisar dar Ouvidoria pra
  alguém sem dar Agenda, a permissão única não separa. Mitigação: nenhuma até acontecer — nenhuma
  história de usuário desta entrega pede isso, e trocar uma permissão por três é um refactor
  pequeno e isolado (`can(role, "channels.manage")` tem poucos call sites) se vier a ser preciso.
- **Seletor de faixas livres duplicado entre `/agendar` e `/admin/agenda`** → se ficar como
  duplicação (ver Open Questions), os dois podem divergir visualmente com o tempo. Mitigação:
  a lógica (`appointmentOccupancy`, o que conta como faixa livre) é 100% núcleo compartilhado; só
  a apresentação duplica, que é o mesmo trade-off que o painel inteiro já assume (design system
  do admin não compartilha componente com o público, por decisão registrada em `icon.tsx`).
- **Sentenças de atividade recente por mapa de `action`** → uma ação nova sem entrada no mapa cai
  num fallback genérico ("Um evento foi registrado — PROTOCOLO"); não quebra, só fica menos
  legível. Mitigação: revisão de código pega isso (o mapa fica no mesmo arquivo que declara as
  actions, lado a lado).

## Open Questions

- O seletor de faixas livres de `proposeAppointmentSlot` é um componente novo compartilhado por
  `/agendar` e `/admin/agenda/[protocolo]`, ou uma versão própria do admin que só chama o mesmo
  `appointmentOccupancy`? Tasks.md assume a segunda opção (consistente com o resto do painel não
  compartilhar componente de UI com o público), revisar se a duplicação visual incomodar na
  revisão do PR.

## Context

`submitServiceRequest` (`src/app/(public)/solicitar/actions.ts`) hoje só retorna sucesso ou erro de validação/limite de anexo. Precisamos de um terceiro caminho — "já existe um pedido igual em andamento" — que não é erro de validação, é um estado que o cidadão precisa decidir o que fazer.

## Goals / Non-Goals

**Goals:**
- Detectar, no servidor, um pedido aberto do mesmo tenant + ato + CPF antes de criar um novo.
- Comunicar isso ao cidadão via diálogo com o número do protocolo existente e um link para consultá-lo.

**Non-Goals:**
- Não deduplicar por nome ou telefone — só CPF e e-mail identificam a pessoa de forma
  confiável o bastante, e são os dois únicos campos que já servem a esse papel em outros
  pontos do produto (CPF na busca do admin, e-mail no `contact` do pedido).
- Não tornar essa checagem uma regra de banco (constraint/índice único) — é uma regra de produto, com exceções possíveis no futuro (ex.: permitir reenvio após indeferimento), então fica no núcleo, não no schema.

## Decisions

**Onde checar**: `findOpenServiceRequestDuplicate` (`src/lib/service-request.ts`), chamada em `submitServiceRequest` (`src/app/(public)/solicitar/actions.ts`) antes de `collectAttachments` — não dentro de `createServiceRequest`/`createRecord`. `createRecord` é usado por outros `kind` (appointment, data-rights, ombudsman) que não têm o conceito de "ato" e não devem herdar essa regra; e checar antes do upload evita órfãos no blob store se a checagem rodasse depois (mesmo raciocínio do bloqueio de anexo da gratuidade, logo abaixo dela no código).

**Definição de "mesmas características"**: mesmo `tenantSlug` + `actId` + status em
`!TERMINAL_SERVICE_REQUEST_STATUSES` (usa o helper `isOpenServiceRequestStatus` já existente em
`src/core/request/kinds.ts` — sem regra nova de status) + o mesmo cidadão. "Mesmo cidadão" não é
só CPF: o campo é opcional no formulário público (`publicServiceRequestSchema`), então uma
checagem só por CPF deixaria passar batido exatamente o caso que motivou a mudança sempre que o
cidadão não o preenche. O e-mail é obrigatório no mesmo formulário, então é o identificador de
reserva: CPF quando informado (com fallback para e-mail, cobrindo o typo de CPF com o mesmo
e-mail), e-mail quando não.

**Forma do retorno**: `submitServiceRequest` passa a poder devolver `{ status: "duplicate", protocolNumber: string }` além de `{ status: "ok", ... }` / erro de validação. O componente client (`request-form.tsx`) reage a esse status abrindo o diálogo, em vez de tratar como erro de campo.

**Diálogo**: reaproveita o padrão `<dialog>` nativo com `showModal()` do admin (`src/app/admin/_components/dialog.tsx`), mas como componente novo e local ao fluxo público (`(public)/solicitar`) — o componente do admin não é compartilhado hoje e misturar import cross-área (admin → public) não se justifica para um `<dialog>` de poucas linhas.

**Link do botão**: `/protocolo?numero=<protocolNumber>`, a mesma rota de consulta pública já existente, sem exigir access key (consistente com o comportamento atual de consulta por número).

## Risks / Trade-offs

- [Corrida entre duas abas/duas submissões quase simultâneas do mesmo CPF] → a checagem SELECT-then-INSERT não é atômica; aceitável porque o pior caso é o mesmo de hoje (duplicidade ocasional), não uma regressão, e não há requisito de unicidade forte no banco.
- [Cidadão com CPF diferente mas mesma pessoa (erro de digitação anterior)] → fora do escopo; a checagem é só por CPF exato.

## Open Questions

Nenhuma pendente — decisões acima cobrem a implementação.

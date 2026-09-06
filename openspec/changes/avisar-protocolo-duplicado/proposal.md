## Why

Hoje o cidadão pode abrir um pedido pelo site sem que o sistema avise que já existe um pedido do mesmo CPF, para o mesmo ato, ainda em andamento. Isso gera protocolos duplicados, confunde a serventia (dois pedidos concorrentes para a mesma coisa) e faz o cidadão perder tempo preenchendo tudo de novo quando já tinha um protocolo aberto.

## What Changes

- Antes de submeter o pedido, o servidor verifica se já existe um `service-request` do mesmo tenant, mesmo `actId` e mesmo CPF com status em aberto (`isOpenServiceRequestStatus`).
- Se existir, a submissão é bloqueada e o cliente exibe um diálogo avisando que o cidadão já possui um pedido em andamento com essas características, com o número do protocolo e um botão/link para consultá-lo (`/protocolo?numero=<protocolNumber>`).
- O cidadão pode fechar o diálogo e ajustar o pedido (ex.: ato diferente) para tentar de novo; nada é submetido automaticamente em nome dele.

## Capabilities

### New Capabilities

(nenhuma)

### Modified Capabilities

- `service-request`: novo requisito de checagem de duplicidade (mesmo tenant + ato + CPF + status aberto) antes de criar o pedido, com diálogo de aviso e link para o protocolo existente.

## Impact

- `src/lib/service-request.ts`: `createServiceRequest` passa a checar duplicidade antes de `createRecord` (nova consulta em `serviceRequests` por `tenantSlug` + `actId` + `cpf` + status aberto).
- `src/app/(public)/solicitar/actions.ts`: `submitServiceRequest` retorna um novo tipo de resultado ("duplicado") com o número do protocolo existente, em vez de erro genérico.
- `src/app/(public)/solicitar/request-form.tsx`: novo diálogo (padrão `<dialog>` nativo, já usado no admin) exibido quando o resultado é de duplicidade, com link para `/protocolo?numero=...`.
- Não requer migração de banco: usa colunas e índice de busca já existentes (`tenantSlug`, `actId`, `cpf`, `status`).

## Não-objetivos

- Não impede duas pessoas diferentes de pedirem o mesmo ato (a checagem é por CPF, não só por ato).
- Não cancela nem funde o pedido antigo com o novo — o cidadão decide o que fazer.
- Não cobre `appointment`, `data-rights` nem `ombudsman` (outros `kind` de pedido) nesta mudança, só `service-request`.
- Não adiciona autenticação/sessão do cidadão; o link de consulta segue o mesmo acesso público por número de protocolo que já existe hoje.

## Why

Duas serventias novas entram na plataforma: o Serviço Único Notarial e Registral de Taipu
(CNS 09.377-3) e o Ofício Único de Bento Fernandes (CNS 09.502-6), ambos em RN. Mesmo padrão já
provado com Marinho, Aurora, Bom Jesus e Major Sales: registrar um cartório é preencher
configuração, nunca escrever código.

## What Changes

- Novo `src/core/tenant/tenants/taipu.ts`.
- Novo `src/core/tenant/tenants/bento-fernandes.ts`.
- Registro dos dois em `src/core/tenant/resolve.ts` (`TENANTS`), habilitando os hosts
  `taipu.localhost` / `cartoriotaipurn.com` e `bentofernandes.localhost` /
  `cartoriobentofernandesrn.com.br`.
- Nenhuma mudança de schema, gating, banco ou comportamento compartilhado.

### Não-objetivos

- Não altera `TenantSchema` nem qualquer regra de gating por atribuição.
- Não cria seed de banco, conta de admin nem convite.
- Não sobe logos, foto de hero nem chave Pix: placeholders marcados `ponytail:`, como nas
  serventias anteriores sem assets próprios.
- Não configura DNS nem verificação de domínio no Postmark.

## Capabilities

### New Capabilities

Nenhuma. Mesma capacidade já especificada de "cadastrar cartório por configuração".

### Modified Capabilities

Nenhuma.

## Impact

- `src/core/tenant/tenants/taipu.ts` (novo)
- `src/core/tenant/tenants/bento-fernandes.ts` (novo)
- `src/core/tenant/resolve.ts` (duas linhas no registro)
- Testes parametrizados pelo registro cobrem os dois tenants automaticamente
  (`src/core/tenant/tenant.test.ts`, `e2e/tenants.spec.ts`).
- Fora do código: DNS dos dois domínios, verificação no Postmark para os remetentes
  `nao-responda@cartoriotaipurn.com` e `nao-responda@cartoriobentofernandesrn.com.br`, e criação
  das caixas de DPO institucionais.

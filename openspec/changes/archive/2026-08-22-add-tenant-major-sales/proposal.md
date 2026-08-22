## Why

O Ofício Único de Major Sales / RN (CNS 09.507-5) entra na plataforma como a quarta serventia.
Registrar um cartório é preencher configuração, não escrever código: o objetivo aqui é provar
isso mais uma vez e deixar o site público e o painel do cartório no ar sob domínio próprio.

## What Changes

- Novo arquivo de configuração `src/core/tenant/tenants/major-sales.ts`, com os dados do
  cartório (slug, hosts, CNS, atribuições, contatos, titular, DPO, tema, textos institucionais).
- Registro do tenant em `src/core/tenant/resolve.ts` (`TENANTS`), o que já habilita o host
  `majorsales.localhost` em desenvolvimento e `cartoriomajorsales.com.br` em produção.
- Nenhuma mudança de comportamento: nenhuma seção nova, nenhum campo novo de schema, nenhuma
  migração de banco.

### Não-objetivos

- Não altera `TenantSchema` nem qualquer regra de gating por atribuição.
- Não cria seed de banco, conta de admin nem convite: isso é operação, feita pelo super admin.
- Não sobe logos, foto de hero, chave Pix nem endereço do cartório: entram quando a serventia
  enviar os arquivos e confirmar os dados (placeholders ficam marcados com `ponytail:`).
- Não configura DNS nem verificação de domínio no Postmark.

## Capabilities

### New Capabilities

Nenhuma. Registrar uma serventia é exercitar `public-site-foundation` como ela já está
especificada — a capacidade "cadastrar cartório por configuração" já existe.

### Modified Capabilities

Nenhuma. Nenhum requisito muda: só entra um dado novo no registro de tenants.

## Impact

- `src/core/tenant/tenants/major-sales.ts` (novo)
- `src/core/tenant/resolve.ts` (uma linha no registro)
- Testes já parametrizados pelo registro cobrem o tenant automaticamente
  (`src/core/tenant/tenant.test.ts`, `e2e/tenants.spec.ts`) — nenhum caso novo a escrever.
- Fora do código: DNS de `cartoriomajorsales.com.br`, domínio verificado no Postmark para o
  remetente `nao-responda@cartoriomajorsales.com.br` e criação da caixa
  `dpo@cartoriomajorsales.com.br`.

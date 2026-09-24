## Why

O Ofício Único de Brejinho / RN (CNS 09.553-9) entra na plataforma como mais uma serventia.
Registrar um cartório é preencher configuração, não escrever código: o objetivo é deixar o site
público e o painel no ar sob o domínio já registrado, `cartoriobrejinhorn.com.br`, no mesmo
molde de Canguaretama, Tibau do Sul e Mipibu.

## What Changes

- Novo arquivo de configuração `src/core/tenant/tenants/brejinho.ts`, com os dados do cartório
  (slug, hosts, CNS, atribuições, contatos, endereço, titular, DPO, tema, textos
  institucionais).
- Registro do tenant em `src/core/tenant/resolve.ts` (`TENANTS`), o que habilita o host
  `brejinho.localhost` em desenvolvimento e `cartoriobrejinhorn.com.br` em produção.
- Nenhuma mudança de comportamento: nenhuma seção nova, nenhum campo novo de schema, nenhuma
  migração de banco.

### Não-objetivos

- Não altera `TenantSchema` nem qualquer regra de gating por atribuição.
- Não cria seed de banco, conta de admin nem convite: isso é operação, feita pelo super admin
  depois do deploy.
- Não sobe logos, foto de hero nem chave Pix: a serventia troca a marca em Identidade Visual e
  cadastra o Pix pelo painel quando quiser.
- Não preenche `emailFrom` nem `revenue`: o primeiro espera a verificação do domínio no
  Postmark, o segundo espera o levantamento no Justiça Aberta.
- Não configura DNS, domínio na Vercel nem verificação no Postmark.

## Capabilities

### New Capabilities

Nenhuma. Registrar uma serventia é exercitar `public-site-foundation` como ela já está
especificada: a capacidade "cadastrar cartório por configuração" já existe.

### Modified Capabilities

- `public-site-foundation`: acrescenta o requisito de que a serventia de Brejinho é servida
  pelos seus hosts próprios, com as seis atribuições e endereço cadastrado. Mesmo formato do
  requisito adicionado por Canguaretama; nenhum requisito existente muda.

## Impact

- `src/core/tenant/tenants/brejinho.ts` (novo)
- `src/core/tenant/resolve.ts` (import + uma linha no registro)
- Testes já parametrizados pelo registro cobrem o tenant automaticamente
  (`src/core/tenant/tenant.test.ts`): nenhum caso novo a escrever.
- Fora do código, a cargo do super admin: apontar o DNS de `cartoriobrejinhorn.com.br` e
  adicioná-lo ao projeto na Vercel; verificar o domínio no Postmark e só então preencher
  `emailFrom`; criar as caixas `contato@`, `dpo@` e `nao-responda@`; criar a primeira conta do
  painel com `pnpm db:seed` e enviar o convite.

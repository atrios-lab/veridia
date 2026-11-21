## Why

O Ofício Único de Cruzeta / RN (CNS 09.554-7) entra na plataforma como mais uma serventia.
Registrar um cartório é preencher configuração, não escrever código: o objetivo é deixar o site
público e o painel no ar sob o domínio já registrado, `cartoriocruzetarn.com.br`, no mesmo
molde de Ruy Barbosa, Brejinho e Canguaretama.

## What Changes

- Novo arquivo de configuração `src/core/tenant/tenants/cruzeta.ts`, com os dados do cartório
  (slug, hosts, CNS, atribuições, contatos, endereço, titular, DPO, tema, textos institucionais,
  receita semestral do Justiça Aberta).
- Registro do tenant em `src/core/tenant/resolve.ts` (`TENANTS`), o que habilita o host
  `cruzeta.localhost` em desenvolvimento e `cartoriocruzetarn.com.br` em produção.
- Nenhuma mudança de comportamento: nenhuma seção nova, nenhum campo novo de schema, nenhuma
  migração de banco.

### Não-objetivos

- Não altera `TenantSchema` nem qualquer regra de gating por atribuição.
- Não cria seed de banco, conta de admin nem convite: isso é operação, feita pelo super admin
  depois do deploy.
- Não sobe logos, foto de hero nem chave Pix: a serventia troca a marca em Identidade Visual e
  cadastra o Pix pelo painel quando quiser.
- Não preenche `emailFrom`: espera a verificação do domínio no Postmark.
- Não configura DNS, domínio na Vercel nem verificação no Postmark.

## Capabilities

### New Capabilities

Nenhuma. Registrar uma serventia é exercitar `public-site-foundation` como ela já está
especificada: a capacidade "cadastrar cartório por configuração" já existe.

### Modified Capabilities

- `public-site-foundation`: acrescenta o requisito de que o Ofício Único de Cruzeta é servido
  pelos seus hosts próprios, com as seis atribuições e endereço cadastrado. Mesmo formato do
  requisito adicionado por Ruy Barbosa; nenhum requisito existente muda.

## Impact

- `src/core/tenant/tenants/cruzeta.ts` (novo)
- `src/core/tenant/resolve.ts` (import + uma linha no registro)
- Testes já parametrizados pelo registro cobrem o tenant automaticamente
  (`src/core/tenant/tenant.test.ts`): nenhum caso novo a escrever.

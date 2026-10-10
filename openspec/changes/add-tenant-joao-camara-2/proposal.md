## Why

O 2º Ofício de João Câmara / RN (CNS 09.420-1) entra na plataforma como mais uma serventia.
Registrar um cartório é preencher configuração, não escrever código: o objetivo é deixar o site
público e o painel no ar sob o domínio já registrado, `2cartoriojoaocamararn.com.br`, no mesmo
molde de Mipibu 2, Canguaretama e Brejinho.

## What Changes

- Novo arquivo de configuração `src/core/tenant/tenants/joao-camara-2.ts`, com os dados do
  cartório (slug, hosts, CNS, atribuições, contatos, endereço, responsável, DPO, tema, textos
  institucionais, receita semestral do Justiça Aberta).
- Registro do tenant em `src/core/tenant/resolve.ts` (`TENANTS`), o que habilita o host
  `joaocamara.localhost` em desenvolvimento e `2cartoriojoaocamararn.com.br` em produção.
- Nenhuma mudança de comportamento: nenhuma seção nova, nenhum campo novo de schema, nenhuma
  migração de banco.

### Não-objetivos

- Não altera `TenantSchema` nem qualquer regra de gating por atribuição.
- Não cria seed de banco, conta de admin nem convite: isso é operação, feita pelo super admin
  depois do deploy.
- Não sobe logos, foto de hero nem chave Pix: a serventia troca a marca em Identidade Visual e
  cadastra o Pix pelo painel quando quiser.
- Não preenche `emailFrom`: espera a verificação do domínio no Postmark.
- Não configura DNS, domínio na Vercel nem verificação no Postmark. O domínio já está nos
  nameservers da Vercel; falta adicioná-lo ao projeto.
- Não registra o 1º Ofício de João Câmara (CNS 09.379-9), que fica com imóveis, títulos e
  documentos e pessoas jurídicas.

## Capabilities

### New Capabilities

Nenhuma. Registrar uma serventia é exercitar `public-site-foundation` como ela já está
especificada: a capacidade "cadastrar cartório por configuração" já existe.

### Modified Capabilities

- `public-site-foundation`: acrescenta o requisito de que o 2º Ofício de João Câmara é servido
  pelos seus hosts próprios, com as atribuições de notas, protesto e registro civil das pessoas
  naturais e endereço cadastrado. Mesmo formato do requisito adicionado por Brejinho; nenhum
  requisito existente muda.

## Impact

- `src/core/tenant/tenants/joao-camara-2.ts` (novo)
- `src/core/tenant/resolve.ts` (import + uma linha no registro)
- Testes já parametrizados pelo registro cobrem o tenant automaticamente
  (`src/core/tenant/tenant.test.ts`): nenhum caso novo a escrever.
- Fora do código, a cargo do super admin: adicionar `2cartoriojoaocamararn.com.br` ao projeto na
  Vercel; verificar o domínio no Postmark e só então preencher `emailFrom`; criar as caixas
  `contato@`, `dpo@` e `nao-responda@`; criar a primeira conta do painel com `pnpm db:seed` e
  enviar o convite.

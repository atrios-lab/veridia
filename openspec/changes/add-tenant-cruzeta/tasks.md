## 1. Configuração do tenant

- [x] 1.1 Criar `src/core/tenant/tenants/cruzeta.ts` com `parseTenant({...})`: slug
  `cartorio-cruzeta`, hosts `["cartoriocruzetarn.com.br", "cruzeta.localhost"]`, name
  "Cartório de Cruzeta", subtitle "Ofício Único de Cruzeta / RN", `about` no molde dos ofícios
  únicos, cns `"095547"`, as seis atribuições, `municipality` "CRUZETA", endereço "Rua João
  Lopes de Araújo, 215, Centro, Cruzeta - RN, 59375-000", contatos ((84) 4042-0744 como
  telefone e WhatsApp, `contato@cartoriocruzetarn.com.br`), `openingHours` "Segunda a sexta, das
  8h às 12h e das 14h às 17h" com `counterHours` 8–17 e intervalo 12h–14h, titular Ivanka Franci
  Delgado Dantas Nobre Costa com status `provido`, dpo com o mesmo nome em
  `dpo@cartoriocruzetarn.com.br`, `issRate` 0.05, tema `oliva-terracota`, `home.title` igual ao
  subtitle, logos `selo-padrao-*`, `revenue` (902698.53 / 913404.37, `justica-aberta`,
  `2026-11-20`) e `legalFooter` no mesmo texto das demais serventias
- [x] 1.2 Comentar no arquivo a fonte (cadastro do CNJ no Justiça Aberta, 20/11/2026); deixar sem
  `heroImage`, sem `pix` e sem `emailFrom` até a verificação do domínio no Postmark; registrar em
  comentário o Gmail e o celular do cadastro do CNJ e o celular da lista oficial; marcar com
  `ponytail:` o horário e a alíquota de ISS
- [x] 1.3 Registrar o tenant em `src/core/tenant/resolve.ts` (import + entrada em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test src/core/tenant/tenant.test.ts` (o teste percorre o registro: schema,
  tema, isolamento por host e receita opcional)
- [ ] 2.2 Abrir o site e conferir: home com o título do ofício único e contato com o cartão de
  endereço e a rota "Como chegar" (conferido em `cruzeta.localhost` em 20/11/2026; falta repetir
  em produção, depois da propagação do DNS)
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar no PR, não executar aqui)

- [x] 3.1 Anotar no PR os passos do super admin: adicionar o domínio ao projeto na Vercel (e o
  redirecionamento do domínio sem `www` para `www`, como nos demais), verificação do domínio no
  Postmark seguida do preenchimento de `emailFrom`, criação das caixas `contato@`, `dpo@` e
  `nao-responda@`, `pnpm db:seed` da primeira conta e envio do convite
- [x] 3.2 Anotar no PR o que falta o cartório confirmar: horário, ISS e logos

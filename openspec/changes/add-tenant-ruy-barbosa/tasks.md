## 1. Configuração do tenant

- [x] 1.1 Criar `src/core/tenant/tenants/ruy-barbosa.ts` com `parseTenant({...})`: slug
  `cartorio-ruy-barbosa`, hosts `["cartorioruybarbosarn.com.br", "ruybarbosa.localhost"]`, name
  "Cartório de Ruy Barbosa", subtitle "Ofício Único de Ruy Barbosa / RN", `about` no molde dos
  ofícios únicos, cns `"094771"`, as seis atribuições, `municipality` "RUY BARBOSA", endereço
  "Rua Conjunto Novo, 02, Centro, Ruy Barbosa - RN, 59420-000", contatos ((84) 4042-0591 como
  telefone e WhatsApp, `contato@cartorioruybarbosarn.com.br`), `openingHours` "Segunda a sexta,
  das 8h às 12h e das 13h às 16h" com `counterHours` 8–16 e intervalo 12h–13h, titular Patrícia
  Morais Monte Florêncio com status `a confirmar`, dpo com o mesmo nome em
  `dpo@cartorioruybarbosarn.com.br`, `issRate` 0.05, tema `vinho-perola`, `home.title` igual ao
  subtitle, logos `selo-padrao-*`, `revenue` (347722.18 / 468414.94, `justica-aberta`,
  `2026-11-17`) e `legalFooter` no mesmo texto das demais serventias
- [x] 1.2 Comentar no arquivo a fonte (cadastro do CNJ no Justiça Aberta, 17/11/2026) e o porquê
  de não usar o agregador; deixar sem `heroImage` e sem `pix` (e sem `emailFrom` até a
  verificação do domínio no Postmark, preenchido depois com `nao-responda@`); registrar em
  comentário o Hotmail do cadastro do CNJ e o celular da lista oficial; marcar com `ponytail:` o
  WhatsApp, o horário e a alíquota de ISS
- [x] 1.3 Registrar o tenant em `src/core/tenant/resolve.ts` (import + entrada em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test src/core/tenant/tenant.test.ts` (o teste percorre o registro: schema,
  tema, isolamento por host e receita opcional)
- [x] 2.2 Abrir o site e conferir: home com o título do ofício único e contato com o cartão de
  endereço e a rota "Como chegar" (feito em produção, `https://www.cartorioruybarbosarn.com.br`,
  em 18/11/2026, depois da propagação do DNS)
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar no PR, não executar aqui)

- [x] 3.1 Anotar no PR os passos do super admin: adicionar o domínio ao projeto na Vercel (e o
  redirecionamento do domínio sem `www` para `www`, como nos demais), verificação do domínio no
  Postmark seguida do preenchimento de `emailFrom`, criação das caixas `contato@`, `dpo@` e
  `nao-responda@`, `pnpm db:seed` da primeira conta e envio do convite
- [x] 3.2 Anotar no PR o que falta o cartório confirmar: WhatsApp, horário, ISS, logos e a
  situação da delegação da titular (provida ou interventora)

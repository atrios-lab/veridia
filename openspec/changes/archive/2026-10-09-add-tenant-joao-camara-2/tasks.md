## 1. Configuração do tenant

- [x] 1.1 Criar `src/core/tenant/tenants/joao-camara-2.ts` com `parseTenant({...})`: slug
  `cartorio-joao-camara-2`, hosts `["2cartoriojoaocamararn.com.br", "joaocamara.localhost"]`,
  name "2º Cartório de João Câmara", subtitle "2º Ofício de Notas, Protesto e Registro Civil de
  João Câmara / RN", `about` no molde de Mipibu 2, cns `"094201"`, atribuições
  `["RCPN", "NOTAS", "PROTESTO"]`, `municipality` "JOAO CAMARA", `location` João Câmara/RN,
  endereço "Rua Antônio Proença, 241, Centro, João Câmara - RN, 59550-000", contatos
  ((84) 4042-1044 como telefone e WhatsApp, `contato@2cartoriojoaocamararn.com.br`),
  `openingHours` "Segunda a sexta, das 8h às 17h" com `counterHours` 8–17, responsável Gladis
  Rosane Schmidt com status `interino`, dpo com o mesmo nome em
  `dpo@2cartoriojoaocamararn.com.br`, `issRate` 0.05, tema `oliva-terracota`, `home.title`
  igual ao subtitle, logos `selo-padrao-*`, `revenue` (298905.11 / 192976.58,
  `justica-aberta`, `2026-10-09`) e `legalFooter` no mesmo texto das demais serventias
- [x] 1.2 Comentar no arquivo a fonte (cadastro do CNJ no Justiça Aberta, 09/10/2026) e o porquê
  de não usar os agregadores; deixar sem `emailFrom`, sem `heroImage` e sem `pix`, com o
  comentário de motivo já usado em Brejinho; registrar em comentário o Gmail do cadastro do CNJ;
  marcar com `ponytail:` o WhatsApp e a alíquota de ISS
- [x] 1.3 Registrar o tenant em `src/core/tenant/resolve.ts` (import + entrada em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test src/core/tenant/tenant.test.ts` (o teste percorre o registro: schema,
  tema, isolamento por host e receita opcional)
- [x] 2.2 Subir o dev server e abrir `http://joaocamara.localhost:3000`: home com o título do
  2º Ofício, navegação só com as seções de notas, protesto e registro civil, e contato com o
  cartão de endereço e a rota "Como chegar"
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar no PR, não executar aqui)

- [x] 3.1 Anotar no PR os passos do super admin: adicionar o domínio ao projeto na Vercel (os
  nameservers já são os da Vercel), verificação do domínio no Postmark seguida do preenchimento
  de `emailFrom`, criação das caixas `contato@`, `dpo@` e `nao-responda@`, `pnpm db:seed` da
  primeira conta e envio do convite
- [x] 3.2 Anotar no PR o que falta o cartório confirmar: WhatsApp, ISS, se mantém o Gmail como
  contato público, e logos

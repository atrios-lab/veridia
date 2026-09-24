## 1. Configuração do tenant

- [x] 1.1 Criar `src/core/tenant/tenants/brejinho.ts` com `parseTenant({...})`: slug
  `cartorio-brejinho`, hosts `["cartoriobrejinhorn.com.br", "brejinho.localhost"]`, name
  "Cartório de Brejinho", subtitle "Ofício Único de Brejinho / RN", `about` no molde dos ofícios
  únicos, cns `"095539"`, as seis atribuições, `municipality` "BREJINHO", endereço "Av. Antônio
  Alves Pessoa, 1008, Centro, Brejinho - RN, 59219-000", contatos ((84) 3283-2071 como telefone
  e WhatsApp, `contato@cartoriobrejinhorn.com.br`), `openingHours` "Segunda a sexta, das 8h às
  12h e das 14h às 18h" com `counterHours` 8–18, titular Antônio Paulino da Silva com status
  `a confirmar`, dpo com o mesmo nome em `dpo@cartoriobrejinhorn.com.br`, `issRate` 0.05, tema
  `grafite-cobre`, `home.title` igual ao subtitle, logos `selo-padrao-*` e `legalFooter` no
  mesmo texto das demais serventias
- [x] 1.2 Deixar sem `emailFrom`, sem `heroImage`, sem `pix` e sem `revenue`, cada ausência
  com o comentário de motivo já usado em Canguaretama; marcar com `ponytail:` o WhatsApp, o
  horário e a alíquota de ISS
- [x] 1.3 Registrar o tenant em `src/core/tenant/resolve.ts` (import + entrada em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test src/core/tenant/tenant.test.ts` (o teste percorre o registro: schema,
  tema, isolamento por host e receita opcional)
- [x] 2.2 Subir o dev server e abrir `http://brejinho.localhost:3000`: home com o título do
  ofício único, navegação com as seções das seis atribuições e contato com o cartão de endereço
  e a rota "Como chegar"
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar no PR, não executar aqui)

- [ ] 3.1 Anotar no PR os passos do super admin: DNS e domínio na Vercel, verificação do domínio
  no Postmark seguida do preenchimento de `emailFrom`, criação das caixas `contato@`, `dpo@` e
  `nao-responda@`, `pnpm db:seed` da primeira conta e envio do convite
- [ ] 3.2 Anotar no PR o que falta o cartório confirmar: WhatsApp, horário real, ISS, logos e
  situação da delegação do titular

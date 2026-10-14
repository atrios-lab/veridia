## 1. Configuração do tenant

- [x] 1.1 Criar `src/core/tenant/tenants/canguaretama.ts` com `parseTenant({...})`: slug
  `cartorio-canguaretama`, hosts `["cartoriocanguaretamarn.com.br", "canguaretama.localhost"]`,
  name "Cartório de Canguaretama", subtitle "Ofício Único de Registros e Notas de Canguaretama /
  RN", `about` no molde dos ofícios únicos, cns `"095190"`, as seis atribuições,
  `municipality` "CANGUARETAMA", endereço "Rua André de Albuquerque, 155, Centro, Canguaretama -
  RN, 59190-000", contatos ((84) 3241-2280 como telefone e WhatsApp,
  `contato@cartoriocanguaretamarn.com.br`), `openingHours` "Segunda a sexta, das 8h às 12h e
  das 14h às 18h" com `counterHours` 8–18, titular Maria dos Ramos Freire Vieira com status
  `a confirmar`, dpo com o mesmo nome em `dpo@cartoriocanguaretamarn.com.br`, `issRate` 0.05,
  tema `marinho-bronze`, `home.title` igual ao subtitle, logos `selo-padrao-*` e `legalFooter`
  no mesmo texto das demais serventias
- [x] 1.2 Deixar sem `emailFrom`, sem `heroImage`, sem `pix` e sem `revenue`, cada ausência
  com o comentário de motivo já usado em Tibau do Sul; marcar com `ponytail:` o WhatsApp, o
  horário e a alíquota de ISS
- [x] 1.3 Registrar o tenant em `src/core/tenant/resolve.ts` (import + entrada em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test src/core/tenant/tenant.test.ts` (o teste percorre o registro: schema,
  tema, isolamento por host e receita opcional)
- [x] 2.2 Subir o dev server e abrir `http://canguaretama.localhost:3000`: home com o título do
  ofício único, navegação com as seções das seis atribuições e contato com o cartão de endereço
  e a rota "Como chegar"
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar no PR, não executar aqui)

- [x] 3.1 Anotar no PR os passos do super admin: DNS e domínio na Vercel, verificação do domínio
  no Postmark seguida do preenchimento de `emailFrom`, criação das caixas `contato@`, `dpo@` e
  `nao-responda@`, `pnpm db:seed` da primeira conta e envio do convite
- [x] 3.2 Anotar no PR o que falta o cartório confirmar: WhatsApp, horário real, ISS, logos e
  situação da delegação da titular

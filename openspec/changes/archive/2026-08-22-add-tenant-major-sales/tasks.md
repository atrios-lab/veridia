## 1. Configuração do tenant

- [x] 1.1 Criar `src/core/tenant/tenants/major-sales.ts` com `parseTenant({...})`: slug
  `cartorio-major-sales`, hosts `["cartoriomajorsales.com.br", "majorsales.localhost"]`, name
  "Cartório de Major Sales", subtitle "Ofício Único de Major Sales / RN", `about`, cns
  `"095075"`, as seis atribuições, contatos ((84) 3190-0980 e
  `contato@cartoriomajorsales.com.br`), `emailFrom` `nao-responda@cartoriomajorsales.com.br`,
  titular Patrícia Magna de Oliveira com status `a confirmar`, dpo com
  `dpo@cartoriomajorsales.com.br`, `issRate` 0.05, tema `vinho-perola`, `home.title` igual ao
  subtitle e `legalFooter` no mesmo texto das demais serventias
- [x] 1.2 Deixar sem `address`, sem `heroImage` e sem `pix`; marcar com comentário `ponytail:`
  o horário (8h–17h), a alíquota de ISS e os logos provisórios (`/logos/CM-*`)
- [x] 1.3 Registrar o tenant em `src/core/tenant/resolve.ts` (import + entrada em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test` (o `tenant.test.ts` já percorre o registro: valida schema, tema e
  isolamento por host)
- [x] 2.2 Subir o dev server e abrir `http://majorsales.localhost:3000` — home, contato (sem
  cartão de endereço) e navegação com as seções das seis atribuições
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar, não executar aqui)

- [x] 3.1 Anotar no PR o que falta o cartório confirmar: endereço, horário real, ISS, logos,
  situação da delegação e criação das caixas `dpo@` e `nao-responda@`

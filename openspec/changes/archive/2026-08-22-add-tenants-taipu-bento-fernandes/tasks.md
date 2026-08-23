## 1. Configuração dos tenants

- [x] 1.1 Criar `src/core/tenant/tenants/taipu.ts`: slug `cartorio-taipu`, hosts
  `["cartoriotaipurn.com", "taipu.localhost"]`, name "Cartório de Taipu", subtitle "Serviço
  Único Notarial e Registral de Taipu / RN", cns `"093773"`, as seis atribuições, contatos
  ((84) 4042-0593 e `contato@cartoriotaipurn.com`), `emailFrom`
  `nao-responda@cartoriotaipurn.com`, `openingHours` "Segunda a sexta, das 8h às 12h e das 14h
  às 17h" com `counterHours` 8–17, endereço "Rua Salvina Soares de Miranda, 11-B, Centro, Taipu
  - RN, 59565-000", titular Selma Teixeira de Menezes (`a confirmar`), dpo em
  `dpo@cartoriotaipurn.com`, `issRate` 0.05, tema `grafite-cobre`
- [x] 1.2 Criar `src/core/tenant/tenants/bento-fernandes.ts`: slug `cartorio-bento-fernandes`,
  hosts `["cartoriobentofernandesrn.com.br", "bentofernandes.localhost"]`, name "Cartório de
  Bento Fernandes", subtitle "Ofício Único de Bento Fernandes / RN", cns `"095026"`, as seis
  atribuições, contatos ((84) 4042-0779 e `contato@cartoriobentofernandesrn.com.br`),
  `emailFrom` `nao-responda@cartoriobentofernandesrn.com.br`, sem `address`, titular Gladis
  Rosane Schmidt (`a confirmar`), dpo em `dpo@cartoriobentofernandesrn.com.br`, `issRate` 0.05,
  tema `oliva-terracota`
- [x] 1.3 Deixar os dois sem `heroImage` e sem `pix`; marcar com comentário `ponytail:` a
  alíquota de ISS e os logos provisórios (`/logos/CM-*`)
- [x] 1.4 Registrar os dois em `src/core/tenant/resolve.ts` (imports + entradas em `TENANTS`)

## 2. Verificação

- [x] 2.1 `pnpm test` (o `tenant.test.ts` percorre o registro inteiro: schema, tema, isolamento
  por host, incluindo a guarda contra vazamento de host adicionada na correção anterior)
- [x] 2.2 Subir o dev server e abrir `taipu.localhost:3000` e `bentofernandes.localhost:3000` —
  home e navegação com as seis atribuições; contato de Bento Fernandes sem cartão de endereço
- [x] 2.3 `pnpm biome check` e `pnpm tsc --noEmit` limpos

## 3. Pendências fora do código (registrar, não executar aqui)

- [x] 3.1 Anotar no PR o que falta cada cartório confirmar: endereço de Bento Fernandes,
  horário exato, ISS, logos, situação da delegação e criação das caixas `dpo@`/`nao-responda@`
  nos dois domínios

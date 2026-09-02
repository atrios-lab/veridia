## Why

A "Cidade" que alimenta o campo Merchant City do QR Pix é, na prática, um dado estrutural da
serventia — o município da sua sede não muda, e quem cadastra a serventia no código já sabe
exatamente qual é. Hoje, em vez disso, esse valor é digitado à mão pelo registrador na aba
Cobrança, sujeito a confusão (já houve caso de alguém digitar o nome da serventia em vez da
cidade) e ao limite de 15 caracteres do padrão Bacen, que exige abreviar nomes de município
longos — uma decisão que um registrador não tem contexto pra tomar sob pressão, mas que quem
cadastra o tenant no código toma uma vez, com calma. Tratar isso como um campo editável no
painel resolve um problema que não existe (o município mudar) e cria um problema que existe
(o registrador ter que adivinhar a abreviação certa).

## What Changes

- Novo campo estrutural `municipality` no `TenantSchema`, ao lado de `address`/`cns`/`name`:
  definido uma vez por serventia, em `src/core/tenant/tenants/*.ts`, já normalizado ao formato do
  Merchant City (maiúsculas, sem acento, até 15 caracteres).
- **BREAKING**: `pix.city` deixa de existir como campo gravável da chave Pix. O Merchant City do
  QR passa a vir sempre de `tenant.municipality`, nunca de um valor por-chave.
- A aba Cobrança (`/admin/configuracoes/cobranca`) perde o campo "Cidade": o formulário volta a
  ter só tipo e valor da chave, como antes da introdução do QR Pix.
- `municipality` não ganha exibição em nenhuma tela do painel: ninguém edita, então não precisa
  aparecer — ao contrário de nome/CNS (mostrados só-leitura por serem dados que a serventia
  reconhece e usa no dia a dia), o município é um detalhe técnico do QR Pix sem motivo pra ocupar
  tela. Uma correção, se um dia for necessária, é uma mudança de código, igual a corrigir um CNS
  errado — não precisa de superfície no painel pra isso.
- `canBuildPixCharge`/degradação do QR: a condição "sem cidade" deixa de existir como estado
  possível para serventias corretamente cadastradas (município é obrigatório no schema); QR passa
  a depender só de chave Pix e valor.
- Migração de dados: as serventias já existentes (`bom-jesus.ts`, `taipu.ts`, `santa-cruz.ts`,
  `marinho.ts`, e demais) ganham `municipality` preenchido no próprio arquivo, e o valor hoje
  gravado em `pix.city` (override em `tenant_content`) é descartado — cada serventia com chave
  cadastrada volta a gerar QR imediatamente, com o município correto vindo do código, sem precisar
  reabrir a aba Cobrança.

## Capabilities

### New Capabilities

(nenhuma — é reorganização de campos entre capacidades existentes)

### Modified Capabilities

- `pix-charge-qr`: o requirement "Cidade da serventia cadastrada e validada no bloco Cobrança" é
  removido — a aba Cobrança volta a ter só tipo e valor da chave, como a spec de
  `admin-billing-settings` sempre descreveu (esse requirement nunca chegou a alterar
  `admin-billing-settings`, então essa capacidade não muda). O Merchant City do payload passa a
  vir de `tenant.municipality` (estrutural), não de `pix.city` (override por chave); o cenário
  "chave sem cidade" deixa de existir, e a degradação por ausência de dado passa a depender só de
  chave e valor do pedido.

## Impact

- `src/core/tenant/schema.ts`: novo campo `municipality` (obrigatório, mesma validação de
  `isValidPixCity`/`PIX_CITY_MAX_LENGTH`); `pix.city` removido do objeto `pix`.
- `src/core/tenant/tenants/*.ts`: cada tenant ganha `municipality`.
- `src/core/tenant/overrides.ts`: `OfficePixSchema`/`OfficePixOverrideSchema` perdem `city`.
- `src/core/payment/pix-charge.ts`, `src/lib/pix-qr.ts`: leem `tenant.municipality` em vez de
  `tenant.pix.city`; `canBuildPixCharge` perde o parâmetro `city` separado (cidade sempre presente
  quando o tenant é válido).
- `src/app/admin/(dashboard)/configuracoes/cobranca/{pix-key-form.tsx,actions.ts}`: campo e
  validação de cidade removidos do formulário e da action de salvar.
- Sem migração de banco: `pix.city` mora no JSONB de `tenant_content` (override), então removê-lo
  do schema é só parar de ler/gravar essa chave — nenhuma coluna envolvida.

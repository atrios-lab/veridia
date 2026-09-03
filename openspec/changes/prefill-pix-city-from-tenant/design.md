## Context

O campo Merchant City do payload Pix (EMV/BR Code, campo 60) foi introduzido em
`add-request-payment-qr` como `pix.city`, um valor por-chave, gravado junto do tipo e do valor da
chave Pix na aba Cobrança (`/admin/configuracoes/cobranca`), com a mesma permissão `billing.edit`.
Na época, o design registrou que "não existe, em lugar nenhum da plataforma, um campo de cidade da
serventia" — por isso a decisão de criar um campo novo, editável, dentro do bloco Pix.

Isso já causou confusão em produção: um registrador digitou o nome da serventia ("CARTORIO
MARINHO") no campo Cidade, e outro esbarrou no limite de 15 caracteres sem saber que precisava
abreviar o nome do próprio município. As duas coisas apontam para o mesmo problema: a cidade da
serventia não é uma decisão operacional do dia a dia, é um fato fixo sobre a serventia, do mesmo
tipo que nome, CNS e endereço — todos hoje definidos uma vez em `src/core/tenant/tenants/*.ts`.
Ao contrário de nome e CNS, porém, o município não precisa de tela nenhuma no painel: ninguém ali
edita esse valor, então não há razão para exibi-lo — diferente de nome/CNS, que a serventia
reconhece e usa no dia a dia (documentos, atendimento), o município é só um detalhe técnico do
payload Pix.

## Goals / Non-Goals

**Goals:**
- O município da serventia passa a ser um dado estrutural (`tenant.municipality`), definido uma
  vez no código do tenant, já normalizado ao formato do Merchant City.
- A aba Cobrança deixa de pedir "Cidade": o registrador só cuida do que realmente pode mudar
  (tipo e valor da chave Pix).
- Serventias que já têm chave Pix cadastrada passam a ter QR Code funcionando assim que o deploy
  sai, sem precisar reabrir nenhuma tela — o município vem do código, não de um valor pendente de
  preenchimento.

**Non-Goals:**
- Não introduz nenhuma tela ou fluxo para o registrador corrigir o município sozinho, nem exibe o
  valor em algum bloco somente-leitura do painel — assim como nome e CNS errados hoje, um
  município errado é corrigido por quem tem acesso ao código, não pelo painel; e ao contrário de
  nome/CNS, ninguém no painel precisa consultar esse valor no dia a dia, então não há motivo para
  dar a ele uma tela.
- Não resolve nomes de município com mais de 15 caracteres automaticamente (abreviação continua
  sendo escolha de quem cadastra o tenant) — só move essa escolha de "sob pressão, no painel" para
  "com calma, no code review".
- Não muda o payload Pix em si (TLV, CRC16, Merchant Name, TxID) — só a origem do valor do campo
  Merchant City.

## Decisions

### 1. `municipality` é um campo novo em `TenantSchema`, não uma reinterpretação de `address`

`tenant.address` já existe, mas é texto livre de rua/número/bairro/cidade/UF em formatos
inconsistentes entre serventias (`"Praça Padre João Maria, 24, Bom Jesus - RN, 59270-000"`,
`"Rua José Camilo Bezerra, 44, Centro, Ielmo Marinho / RN"`) — extrair a cidade dali por parsing
seria frágil e dependente de convenção que ninguém garante manter. `municipality` é um campo
próprio, com uma responsabilidade: guardar o nome do município já no formato que o Merchant City
exige (maiúsculas, sem acento, até 15 caracteres), validado com a mesma `isValidPixCity` que hoje
valida `pix.city`.

Alternativa considerada e rejeitada: derivar `municipality` de `address` por regex no momento de
montar o payload. Rejeitada por acoplar a geração do QR ao formato de um campo de texto livre
pensado para exibição humana (mapa, "como chegar"), não para um padrão de pagamento — qualquer
mudança de formato em `address` quebraria o Pix silenciosamente.

### 2. `pix.city` sai do schema; `pix` volta a ter só `type` e `key`

Hoje `pix.city` é opcional no schema (por causa de serventias que cadastraram a chave antes do
campo existir) e obrigatório na action de salvar. Com `municipality` estrutural e sempre presente,
manter `pix.city` como um segundo valor de cidade (por-chave, ainda que raramente preenchido
diferente) seria duas fontes de verdade para o mesmo dado. `pix.city` é removido; `pix-charge.ts`
e `pix-qr.ts` passam a ler `tenant.municipality` diretamente.

**BREAKING**: overrides já gravados em `tenant_content` com `pix.city` deixam de ser lidos (o
`OfficePixSchema`/`OfficePixOverrideSchema` não declara mais o campo, então ele é ignorado na
leitura — mesmo comportamento já descrito em "Override corrompido é ignorado" para outros campos
do bloco Pix). Nenhuma migração de banco é necessária: o valor antigo simplesmente para de ser
lido, sem erro.

### 3. `canBuildPixCharge` perde o parâmetro `city`

Hoje a função pede `amountCents`, `pixKey` e `city` juntos. Com município sempre presente para
qualquer tenant válido, a assinatura passa a pedir só `amountCents` e `pixKey` — o chamador
(`pix-qr.ts`) passa `tenant.municipality` direto para `buildPixCharge`, sem checar presença.
Reduz um estado possível (chave presente, cidade ausente) que não existe mais no domínio.

### 4. Backfill dos tenants existentes é edição de código, não migração de banco

Como cada tenant é um arquivo TypeScript versionado (`src/core/tenant/tenants/*.ts`), adicionar
`municipality` a cada um é uma mudança de código revisada em PR, não uma migração de dados em
produção. A lista de serventias hoje é pequena (Bom Jesus, Taipu, Santa Cruz, Ielmo Marinho, Major
Sales, Bento Fernandes) — cada uma recebe seu município extraído do próprio `address` já
cadastrado, na mesma revisão que remove `pix.city`.

## Risks / Trade-offs

- **Município errado só é corrigido via deploy** → Aceito: é o mesmo modelo já usado para nome e
  CNS, dados que também exigem deploy para corrigir. Não há indício, em nenhum tenant hoje
  cadastrado, de que o município do endereço divirja do município registrado no banco para a
  chave Pix — se isso um dia acontecer para uma serventia específica, é uma correção pontual de
  arquivo, do mesmo tamanho que corrigir um CNS digitado errado.
- **Remove a flexibilidade de a chave Pix apontar para uma cidade diferente do endereço da
  serventia** → Aceito como não-objetivo: nenhum caso real motivou essa flexibilidade até hoje;
  ela existia só porque `pix.city` foi modelado como parte da chave, não porque alguém precisou
  de cidades diferentes.
- **BREAKING no schema (`pix.city` removido)** → Mitigado por não exigir migração de banco (o
  campo mora em JSONB de override, lido de forma tolerante) e por ser reversível: bastaria
  reintroduzir o campo no schema para voltar a ler overrides antigos, se necessário.

## Migration Plan

1. Adicionar `municipality` (obrigatório) ao `TenantSchema`, com a mesma validação de
   `isValidPixCity`.
2. Preencher `municipality` em cada arquivo de `src/core/tenant/tenants/*.ts` (todos os tenants
   existentes precisam do campo para `parseTenant` continuar passando).
3. Atualizar `pix-charge.ts` (`canBuildPixCharge`) e `pix-qr.ts` para usar `tenant.municipality`.
4. Remover `city` de `pix` em `TenantSchema` e dos schemas derivados em `overrides.ts`.
5. Remover o campo "Cidade" de `pix-key-form.tsx` e a validação/gravação correspondente em
   `actions.ts` (aba Cobrança).
6. Atualizar o spec delta (`pix-charge-qr`) e os testes que hoje cobrem `pix.city` (schema,
   `pix-charge.test.ts`, `pix-key-form` e a action de Cobrança).

Sem rollback de banco necessário: reverter é reverter o deploy (o `pix.city` antigo, se ainda
existir em algum override gravado, volta a não ser lido até o schema ser restaurado — não há
perda de dado além do que já era redundante).

## Open Questions

- Confirmar, para cada tenant hoje cadastrado, o município correto a preencher. A maioria tem
  `address` com a cidade ao final (`bom-jesus`, `taipu`, `santa-cruz`, `marinho`); três tenants
  (`aurora`, `bento-fernandes`, `major-sales`) não têm `address` cadastrado, então o município
  precisa vir do `subtitle`/`slug`, que já nomeiam a cidade. Nenhum caso identificado de nome de
  município acima de 15 caracteres na lista atual, mas vale checar na hora do backfill.

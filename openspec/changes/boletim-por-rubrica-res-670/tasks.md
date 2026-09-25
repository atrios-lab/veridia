## 1. Núcleo

- [ ] 1.1 Criar `src/core/transparency/rubrics.ts`: `RUBRICS` (I a IV com o texto do art. 6º, § 3º), `FUNDS_BY_STATE.RN` na ordem da tabela (FDJ → II, FRMP → IV, FCRCPN → III, FUNAF → IV) e `groupByRubric(state, amounts)`, que devolve só as rubricas com fundos, cada uma com subtotal e detalhe, e o total dos fundos sem o ISS; teste com o exemplo da spec (IV = 419,10; total = 1.864,06) e com a rubrica I ausente no RN
- [ ] 1.2 Em `src/core/transparency/bulletin.ts`: remover `BulletinFigures` de quatro valores e `bulletinBalanceCents`; `parseBulletinFigures(state, input)` passa a devolver `{ actsCount, fundAmountsCents, issCents }` ou os erros por campo, exigindo exatamente os fundos da UF e aceitando zero; atualizar `bulletin.test.ts` (campo vazio, zero aceito, centavos exatos, chave de fundo desconhecida rejeitada)
- [ ] 1.3 Parser de leitura para o jsonb: linha com chave faltando, sobrando ou valor não inteiro é erro, nunca zero; teste

## 2. Tenant

- [ ] 2.1 `TenantSchema`: campo obrigatório `location: { city, state }`, com `state` em enum que hoje só tem `"RN"`; comentário explicando por que não reaproveita `municipality` (Pix, caixa alta, 15 caracteres)
- [ ] 2.2 Preencher `location` nos 13 arquivos de `src/core/tenant/tenants/` com a cidade acentuada; ajustar `tenant.test.ts`

## 3. Banco (deploy 1, expand)

- [ ] 3.1 `src/db/schema.ts`: adicionar `fundAmountsCents` (jsonb, NOT NULL, default `{}`) e `issCents` (bigint, NOT NULL, default 0) em `transparency_bulletins`; tornar nuláveis `gross_revenue_cents`, `taxes_paid_cents` e `expenses_cents`, com comentário apontando o contract
- [ ] 3.2 `pnpm db:generate` e revisar o SQL linha a linha; não rodar `db:migrate`

## 4. Camada de dados

- [ ] 4.1 `src/lib/transparency.ts`: `BulletinInput` e `upsertBulletin` gravam só `fundAmountsCents`, `issCents` e `actsCount`; a leitura passa pelo parser do 1.3. A regra fica numa função `...With(db, ...)`
- [ ] 4.2 Teste em processo contra PGlite: publicar, republicar o mesmo mês (substitui, sem duplicar) e ler de volta os valores por fundo e o ISS

## 5. Painel

- [ ] 5.1 `bulletin-form.tsx`: tirar arrecadação, tributos, despesas e a caixa de saldo; um campo por fundo da UF do tenant, na ordem do mapa, com o rótulo da tabela (FDJ, FRMP, FCRCPN, FUNAF), mais ISS e atos
- [ ] 5.2 `actions.ts`: `publishBulletinAction` só faz o transporte e chama o núcleo e a camada de dados; erros por campo com os nomes novos
- [ ] 5.3 `bulletin-preview.tsx`: trocar "De onde veio"/"Para onde foi" e o saldo pelas rubricas com subtotal e detalhe, o total dos fundos, a linha "ISS, tributo municipal (<cidade>)" e o rodapé citando o art. 6º, § 3º, da Res. CNJ 215/2015 com a redação da Res. CNJ 670/2025
- [ ] 5.4 `bulletin-list.tsx` e o cabeçalho do módulo: conferir que nada ainda lê as colunas antigas

## 6. PDF e site

- [ ] 6.1 `src/lib/pdf.ts`: o corpo do PDF do boletim segue a pré-visualização do 5.3; sem saldo nem arrecadação; rodapé com a citação da norma
- [ ] 6.2 `src/app/(public)/transparencia/page.tsx`: aviso fixo do § 3º-B na seção do boletim, visível também no estado vazio
- [ ] 6.3 Conferir no navegador, pelo host de uma serventia: formulário, pré-visualização, publicação, PDF e o aviso na página pública

## 7. Entrega

- [ ] 7.1 Confirmar que `transparency_bulletins` está vazia em produção; aplicar a migração no Homolog (pooler, porta 5432) e em produção (`POSTGRES_URL_NON_POOLING`) antes do merge
- [ ] 7.2 Abrir o PR
- [ ] 7.3 Registrar a change de contract (drop das três colunas antigas e dos defaults) para depois do deploy 1 estar em produção

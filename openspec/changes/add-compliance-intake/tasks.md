## 1. Núcleo

- [x] 1.1 `src/core/compliance/sections.ts`: as 17 seções como dados, com tipo, ajuda, opções, "não sei", `showWhen`, `defaultValue` e itens de lista
- [x] 1.2 `answers.ts`: `prefillAnswers`, `effectiveAnswers`, `missingFields`, `sectionStatus`, `progress`, `resumeSection`, `changedAfterSubmit`, `displayValue`, `parseAnswer` (CPF, CNPJ, CNS, e-mail, opções)
- [x] 1.3 `classification.ts`: classe e subclasse pelo art. 16, prazos pelo art. 20 a partir da vigência
- [x] 1.4 `pendencies.ts`: `detectPendencies`, `unknownAnswers`, contagem por seção
- [x] 1.5 `export.ts`: `toGeneratorJson` no vocabulário do gerador
- [x] 1.6 `compliance.test.ts`: limites de classe, prazos, status, condicionais, listas, progresso, validação, pendências, chaves do export

## 2. Banco e acesso a dados

- [x] 2.1 Tabela `compliance_intakes` em `src/db/schema.ts` e migração `drizzle/0019_kind_bloodaxe.sql`
- [x] 2.2 `src/lib/compliance.ts`: `getIntake`, `prefillFor`, `loadIntake`, `saveAnswer` (merge JSONB), `touchSection`, `submitIntake`, `addAttachments`, `removeAttachment`, com auditoria
- [x] 2.3 `src/lib/email/compliance.ts`: confirmação à serventia e aviso à Átrios

## 3. Painel

- [x] 3.1 Item "Adequação ao Provimento" no menu (grupo Serventia, `content.edit`) e ícone `clipboard`
- [x] 3.2 `/admin/adequacao`: progresso, lista das 17 seções com status e avisos, continuar de onde parei, classe e prazos, faixa de enviado
- [x] 3.3 `/admin/adequacao/[secao]`: `SectionForm` com autosave por campo, "?", "não sei", condicionais, listas, avisos inline, navegação anterior e próxima
- [x] 3.4 Seção 17: upload e exclusão de anexos, rota `/admin/adequacao/anexo`
- [x] 3.5 `/admin/adequacao/revisao`: tudo por seção com "Editar", pendências, declaração, envio, mensagem de recebido
- [x] 3.6 Perfil Átrios na lista: pendências, "não sei", "alterada após o envio", botão e rota `/admin/adequacao/exportar` (só `superadmin`)
- [x] 3.7 Cartão da Visão geral (`compliance-card.tsx`), some o progresso e mostra "enviadas" depois do envio

## 4. Verificação

- [x] 4.1 `e2e/admin-compliance.spec.ts`: resposta salva e avisa na hora, sobrevive a sair e voltar, lista mostra status e aviso, exportar invisível para a serventia
- [ ] 4.2 Rodar `pnpm db:migrate` no Homolog e abrir o módulo com o perfil Átrios e com o da serventia
- [ ] 4.3 Exportar o JSON de uma serventia real e passar pelo gerador; ajustar `export.ts` no que o gerador recusar
- [ ] 4.4 Confirmar com a Átrios a data de vigência do Provimento 243 (`PROVIMENTO_243_IN_FORCE`, hoje 22/08/2026)

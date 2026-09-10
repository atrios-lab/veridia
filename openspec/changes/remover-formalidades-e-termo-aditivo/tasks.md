## 1. Seções e campos

- [x] 1.1 Em `src/core/compliance/sections.ts`, remover o campo `sendAddendum` (e seu label) da
      Seção 14 "Contratos e fornecedores".
- [x] 1.2 Em `src/core/compliance/sections.ts`, remover inteira a Seção 16 "Formalidades"
      (`id: "formalidades"`, campos `lastOrdinance`, `signingDate`, `branding`).
- [x] 1.3 Atualizar os dois help texts que citam "Seção 17" (equipamentos, na Seção 7, e o
      Windows do computador, na Seção 8) para "Seção 16", já que a antiga Seção 17 (Anexos) passa
      a ser a 16.
- [x] 1.4 Atualizar o comentário em
      `src/app/admin/(dashboard)/adequacao/_components/attachments.tsx` que cita "Seção 17" para
      "Seção 16".

## 2. Export para o gerador

- [x] 2.1 Em `src/core/compliance/export.ts`, remover as variáveis `signing` e `lastOrdinance` e
      as chaves `aditivo_fornecedores`, `num_portaria_ultima`, `num_portaria_inicial`, `data`,
      `data_curta` e `sem_marca` do objeto retornado por `toGeneratorJson`.
- [x] 2.2 Conferir se `longDate` e `formatDate` (importados em `export.ts` só para montar `data` e
      `data_curta`) ficam sem uso e remover o import morto, se for o caso. `longDate` (função local)
      removida; `formatDate` segue em uso para `prazo`/`prazo_conclusao`, import mantido.

## 3. Testes

- [x] 3.1 Em `src/core/compliance/compliance.test.ts`, remover o fixture `formalidades:
      { signingDate: "2026-10-05" }` do teste "the export speaks the generator's vocabulary".
- [x] 3.2 No mesmo teste, remover `num_portaria_inicial`, `data`, `data_curta` e `sem_marca` da
      lista de chaves esperadas no JSON, e as asserções diretas `json.data`, `json.data_curta` e
      `json.sem_marca`.
- [x] 3.3 Rodar `node --test src/core/compliance/compliance.test.ts` e confirmar que passa. 14/14
      testes passando.
- [x] 3.4 Em `e2e/admin-compliance.spec.ts`, trocar a asserção `"0 de 17 seções"` para
      `"0 de 16 seções"`.

## 4. Conferência final

- [x] 4.1 Abrir o módulo "Adequação ao Provimento" localmente e confirmar que a Seção 14 não
      pergunta mais sobre o termo aditivo, que não existe mais uma Seção 16 "Formalidades" e que
      "Anexos" agora é a Seção 16 de 16. Conferido por leitura de `sections.ts` (não há
      `DATABASE_URL` local neste worktree para logar no painel e navegar de fato — ver nota abaixo).
- [x] 4.2 Exportar o JSON de uma serventia de teste (perfil Átrios) e confirmar que não contém
      `aditivo_fornecedores`, `num_portaria_ultima`, `num_portaria_inicial`, `data`, `data_curta`
      nem `sem_marca`. Coberto pelo teste `"the export speaks the generator's vocabulary"` em
      `compliance.test.ts` (14/14 passando), que monta o JSON puro sem depender do painel.

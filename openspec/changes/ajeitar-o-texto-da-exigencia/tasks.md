## 1. Núcleo

- [x] 1.1 Em `src/core/request/requirement.ts`, trocar o transform de `requirementTextSchema` para apenas `trim` (sem `replace(/\s+/g, " ")`), teto de 500 para `MAX_MESSAGE_LENGTH` importado de `src/core/chat/message.ts`, e mensagem de estouro "O texto pode ter até 4.000 caracteres." (número derivado da constante, não hardcoded duas vezes)
- [x] 1.2 Atualizar `src/core/request/requirement.test.ts`: quebras de linha e espaços internos preservados, teto novo em `MAX_MESSAGE_LENGTH` (aceita no limite, recusa acima), mensagem de estouro contém "4.000", vazio/só-espaços continua recusado
- [x] 1.3 Em `src/core/request/edit.ts`, subir `purpose` e `description` para `MAX_MESSAGE_LENGTH` com a mesma mensagem de estouro (hoje `.max(500)`/`.max(1000)` sem mensagem)
- [x] 1.4 Atualizar `src/core/request/edit.test.ts` cobrindo o teto novo e a mensagem nos dois campos

## 2. Painel admin

- [x] 2.1 Em `requirements-section.tsx`, adicionar `whitespace-pre-line` ao `<p>` que exibe `requirement.text` (linha ~462)
- [x] 2.2 No mesmo arquivo, `rows={2}` → `rows={4}` nos dois textareas (registrar, ~linha 518, e editar, ~linha 341)

## 3. Consulta pública

- [x] 3.1 Em `protocol-lookup.tsx`, adicionar `whitespace-pre-line` aos dois `<p>` que exibem `requirement.text`: cartão cumprido (~linha 828) e cartão pendente (~linha 860)

## 4. Verificação

- [x] 4.1 Rodar os testes de núcleo (`node --test` nos arquivos tocados) e o typecheck/lint do projeto
- [x] 4.2 Verificação sem escrita: o app sobe e serve sem erro de console. A verificação visual final ficou com o cartório — registrar uma exigência grava no banco de produção e `registerRequirementAction` dispara e-mail real ao cidadão do pedido, o que não se desfaz. O comportamento está coberto pelos testes de núcleo (quebras preservadas, teto, mensagem), e `whitespace-pre-line` é a mesma classe já em uso nas bolhas da conversa dentro do mesmo cartão.

## 1. Núcleo: validação do pedido

- [x] 1.1 Em `src/core/request/form.ts`, tirar `cpf` de `commonFields` e declarar CPF obrigatório em `publicServiceRequestSchema`, com "Informe o CPF." para vazio e "CPF inválido." para dígitos que não conferem
- [x] 1.2 Em `serviceRequestSchema`, aceitar `cpf`, a marcação `noCpf` e `alternateDocument` (tipo e número), recusando envio sem CPF nem exceção, exceção sem documento e CPF junto com a exceção, cada erro no campo certo
- [x] 1.3 Em `src/core/request/kinds.ts`, adicionar `alternateDocument` opcional a `serviceRequestDetailsSchema`, a lista fechada de tipos, o helper de leitura e a máscara do número
- [x] 1.4 Cobrir 1.1 a 1.3 em `src/core/request/request.test.ts`, incluindo o envio sem o campo `cpf` e o contato por telefone no balcão

## 2. Núcleo: correção de dados e requerimento

- [x] 2.1 Em `src/core/request/edit.ts`, criar `resolveIdentityEdit(stored, input)` com as cinco transições do `design.md`, e ajustar `requestDataEditSchema` para ler a marcação e o documento
- [x] 2.2 Cobrir as cinco transições em `src/core/request/edit.test.ts`, incluindo o pedido antigo sem CPF
- [x] 2.3 Em `src/core/request/requerimento.ts`, mostrar o tipo e o número completo do outro documento quando não houver CPF, com teste em `src/core/request/requerimento.test.ts`

## 3. Persistência

- [x] 3.1 Em `src/lib/service-request.ts`, fazer `updateRequestDataWith` gravar e remover `details.alternateDocument`, já que a fusão com `||` não remove chaves
- [x] 3.2 Atualizar o comentário de `findOpenServiceRequestDuplicateWith` que trata o CPF como opcional no formulário, sem mudar a consulta
- [x] 3.3 Cobrir em `src/lib/service-request.test.ts`, contra PGlite: lançamento com a exceção, troca de CPF pela exceção, troca da exceção por CPF, e duplicidade de pedido antigo sem CPF casando pelo e-mail

## 4. Site

- [x] 4.1 Em `src/app/(public)/solicitar/request-form.tsx`, tirar "· opcional" do CPF e colocar junto ao campo a orientação de procurar o balcão para quem não possui o documento
- [x] 4.2 Ajustar `src/app/(public)/solicitar/actions.ts` ao novo tipo do CPF e confirmar que o erro do servidor aparece no campo
- [x] 4.3 Em `src/app/(public)/privacidade/page.tsx`, incluir o CPF nos dados coletados pelo pedido e informar para quê, com o texto final dependendo da justificativa em aberto no `design.md`

## 5. Painel

- [x] 5.1 Em `pedidos/novo/manual-entry-form.tsx`, tirar "(opcional)" do CPF e adicionar a marcação "cidadão não possui CPF", que desabilita o CPF e mostra o tipo e o número do documento
- [x] 5.2 Em `pedidos/novo/actions.ts`, ler os novos campos, gravar `alternateDocument` em `details` e mostrar o documento no resumo do lançamento no lugar de `cpfLabel`
- [x] 5.3 Em `pedidos/[protocolo]/page.tsx` e `_components/applicant-section.tsx`, mostrar "Não possui" e o documento mascarado, e oferecer a mesma marcação no formulário de correção
- [x] 5.4 Em `pedidos/[protocolo]/actions.ts`, chamar `resolveIdentityEdit` com o pedido gravado e devolver a mensagem de recusa
- [x] 5.5 Rever o texto dos campos e dos erros, no tom dos campos vizinhos

## 6. Fechamento

- [x] 6.1 Ajustar os testes e fixtures que montam pedido sem CPF, sem afrouxar a regra, e conferir `scripts/seed-demo-data.ts`
- [x] 6.2 Rodar os testes tocados por esta mudança, `pnpm typecheck` e `pnpm lint`
- [ ] 6.3 Conferir no navegador, pelo host de um cartório, o site e o balcão com CPF, sem CPF e com a exceção
- [x] 6.4 Registrar a finalidade informada pela serventia e a eventual base legal no `design.md` antes do deploy em produção
- [ ] 6.5 Avisar as demais serventias da nova exigência antes do deploy em produção

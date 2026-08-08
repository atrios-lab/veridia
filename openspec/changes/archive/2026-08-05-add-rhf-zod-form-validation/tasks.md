# Tasks: add-rhf-zod-form-validation

## 1. Dependências

- [x] 1.1 Adicionar `react-hook-form` e `@hookform/resolvers` (versão com suporte a Zod 4) via pnpm

## 2. Máscaras

- [x] 2.1 Criar `formatCpf` e `formatPhone` (funções puras) em `src/core/request/form.ts`, com testes em `node --test` cobrindo parciais, completos e e-mail intocado

## 3. Formulário

- [x] 3.1 Em `request-form.tsx`, criar `useForm` com `zodResolver(serviceRequestSchema(act))`, `mode: "onTouched"`, e registrar os campos cobertos pelo schema (nome, contato, cpf, descrição, finalidade, parâmetro, aceites)
- [x] 3.2 Trocar o envio: `noValidate` no form, `onSubmit={handleSubmit(...)}` que despacha `formAction(new FormData(form))` em `startTransition`; honeypot e anexos ficam fora do RHF
- [x] 3.3 `FieldError` passa a mostrar o erro do RHF quando existir, senão o `fieldErrors` do servidor; remover `required`/`maxLength` nativos dos campos registrados
- [x] 3.4 Aplicar as máscaras no `onChange` dos campos CPF e contato (telefone só quando o valor for numérico), repassando o valor formatado ao RHF
- [x] 3.5 Manter estado de pending, tela de sucesso e mensagem de erro geral do servidor como estão

## 4. Verificação

- [x] 4.1 e2e em `e2e/service-request.spec.ts`: CPF inválido mostra erro no blur sem submissão; envio sem aceite LGPD é bloqueado com erro junto ao aceite; máscara aparece ao digitar CPF e telefone; caminho feliz continua passando
- [x] 4.2 Rodar `pnpm typecheck`, `pnpm lint`, `pnpm test` e `pnpm e2e`

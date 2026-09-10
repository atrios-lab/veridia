## 1. Os quatro forms

- [x] 1.1 Em `src/app/(public)/solicitar/request-form.tsx`, adicionar `target="_blank"
      rel="noopener"` aos dois forms da tela de sucesso (comprovante e requerimento), no mesmo
      formato do form de `protocol-trilho.tsx:1452`.
- [x] 1.2 Em `src/app/(public)/protocolo/protocol-lookup.tsx`, o mesmo no form do passo "Baixe o
      requerimento preenchido".
- [x] 1.3 Em `src/app/(public)/acompanhar/protocol-trilho.tsx`, o mesmo no form do passo "Baixe o
      formulário já preenchido".

## 2. O teste que clica

- [x] 2.1 Em `e2e/service-request.spec.ts`, teste novo: enviar um pedido, clicar em "Baixar
      comprovante (PDF)" esperando `context.waitForEvent("page")`, e conferir que a tela de
      sucesso ainda mostra protocolo e chave. Repetir para "Baixar requerimento (PDF)".
- [x] 2.2 No teste da consulta de protocolo que já existe no mesmo arquivo, clicar em "Baixe o
      requerimento preenchido" com a mesma espera pela aba nova.

## 3. Verificação

- [x] 3.1 `pnpm typecheck`, `biome check` e só o `e2e/service-request.spec.ts` passando.
- [x] 3.2 Pelo host do cartório no Homolog, num navegador de verdade: pedir um serviço, clicar nos
      dois botões, ver o PDF em aba nova e a chave ainda na tela atrás.
- [x] 3.3 Abrir o PR a partir da branch; sem push na main.

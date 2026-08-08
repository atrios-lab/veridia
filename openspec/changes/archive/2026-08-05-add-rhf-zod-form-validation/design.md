# Design: add-rhf-zod-form-validation

## Context

`RequestForm` (`src/app/(public)/solicitar/request-form.tsx`) é um client component que envia
via `useActionState` + server action (`submitServiceRequest`). Toda a validação vive em
`serviceRequestSchema(act)` no núcleo puro (`src/core/request/form.ts`) — Zod, sem I/O, sem
framework — e roda só no servidor. O cidadão só descobre erro de campo depois do round-trip.

## Goals / Non-Goals

**Goals:**

- Feedback de erro por campo no cliente, antes do envio, usando o MESMO schema do servidor.
- Zero duplicação de regra: o schema continua no núcleo e é importado pelos dois lados.
- Fluxo de envio intacto: server action segue validando e sendo a fronteira de confiança.

- Máscaras de CPF e telefone enquanto o cidadão digita, sem biblioteca.

**Non-Goals:**

- Validação de anexos no cliente, migração de outros formulários.
- Biblioteca de máscara — os dois formatos necessários cabem em duas funções puras.

## Decisions

1. **Reutilizar `serviceRequestSchema(act)` via `zodResolver`.** O schema é núcleo puro e
   importável no cliente sem custo arquitetural. Alternativa rejeitada: schema paralelo
   "client-side" — duplicaria regra e derivaria com o tempo.

2. **Dependências: `react-hook-form` + `@hookform/resolvers`** (resolvers ≥ 5, com suporte a
   Zod 4). Alternativa rejeitada: validação manual com `safeParse` no `onSubmit` — funciona,
   mas o pedido do usuário é explicitamente RHF, e RHF dá dirty/touched/por-campo de graça.

3. **RHF valida, server action envia.** `handleSubmit` do RHF gateia o envio; no sucesso da
   validação, despacha `formAction(new FormData(event.target))` dentro de `startTransition`.
   Inputs continuam uncontrolled (via `register`), então o `FormData` nativo continua carregando
   exatamente o que o servidor já espera — incluindo honeypot e anexos, que ficam fora do RHF.
   Alternativa rejeitada: `action={formAction}` puro + `noValidate` — não permite bloquear o
   envio com erros do RHF.

4. **Modo de validação `onTouched`.** Erro aparece no blur do campo e revalida a cada mudança
   depois disso — não grita enquanto o cidadão ainda digita.

5. **Erros do servidor continuam renderizados.** `FieldError` mostra o erro do RHF quando
   existir, senão o `fieldErrors` do estado do action (o servidor pode reprovar o que o cliente
   aprovou — anexos, ato indisponível, rate limit). Os atributos `required`/`maxLength` nativos
   saem dos campos cobertos pelo RHF (`noValidate` no form) para a mensagem vir do Zod, não do
   browser.

6. **Máscaras como formatadores puros no núcleo** (`formatCpf`, `formatPhone` em
   `src/core/request/form.ts`, ao lado de `normalizeCpf`): o `onChange` registrado formata o
   valor antes de repassar ao RHF. O CPF é sempre mascarado (`000.000.000-00`); o contato só
   ganha máscara de telefone `(00) 00000-0000` quando o valor digitado é numérico, porque o
   mesmo campo aceita e-mail. O servidor já normaliza (`normalizeCpf`, `isValidContact` ignora
   pontuação), então a máscara não muda nada no parse. Alternativa rejeitada: lib de máscara
   (`react-imask` etc.) — dependência nova para dois formatos fixos.

## Risks / Trade-offs

- [Schema com `transform`/`pipe` no resolver] → `zodResolver` valida sobre o output do parse;
  os inputs seguem uncontrolled e o servidor re-parseia o `FormData` cru, então divergência de
  tipo input/output não afeta o que é enviado.
- [Checkboxes: RHF entrega boolean, `z.coerce.boolean()` aceita ambos] → sem mudança de schema.
- [~11 kB gzip de bundle no route público] → aceito; é o único form do fluxo principal.
- [Bump futuro de Zod 4 quebrar o resolver] → versão do resolver fixada em par com o Zod no
  `package.json`; e2e cobre o caminho feliz e o de erro.

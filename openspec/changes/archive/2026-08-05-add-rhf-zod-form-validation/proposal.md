# Proposal: add-rhf-zod-form-validation

## Why

O formulário de solicitação (`/solicitar`) só valida no server action: o cidadão preenche tudo,
envia, espera a rodada no servidor e só então descobre erro de CPF, contato ou aceite faltante.
Validação no cliente com o mesmo schema Zod elimina essa ida ao servidor para erros triviais e
dá feedback por campo no momento da digitação/blur — sem duplicar regra de negócio.

## What Changes

- Adicionar `react-hook-form` + `@hookform/resolvers` como dependências.
- `RequestForm` passa a usar `useForm` com `zodResolver(serviceRequestSchema(act))`, reutilizando
  o schema que já vive no núcleo puro (`src/core/request/form.ts`) — uma única fonte de validação.
- Erros de campo aparecem no cliente (submit bloqueado até corrigir); os erros vindos do servidor
  continuam exibidos, pois o server action permanece a fronteira de confiança e revalida tudo.
- Honeypot, anexos e o fluxo `useActionState`/server action permanecem como estão; o RHF entra
  apenas como camada de validação antes do envio.
- Máscaras de input no CPF (`000.000.000-00`) e no telefone do campo de contato
  (`(00) 00000-0000`, aplicada só quando o valor é numérico — o campo também aceita e-mail),
  com formatadores puros no núcleo, sem biblioteca de máscara.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `service-request`: o formulário do pedido passa a exigir validação client-side por campo
  (mesmo schema Zod do servidor), mantendo o servidor como fronteira de confiança.

## Non-goals (Não-objetivos)

- Não trocar o fluxo de envio (server action + `useActionState` permanecem).
- Não afrouxar nem remover a validação do servidor — cliente é UX, servidor é segurança.
- Não adicionar biblioteca de máscara — formatadores próprios, puros, no núcleo.
- Não migrar outros formulários (ouvidoria, protocolo, admin) — só o de solicitação.
- Não validar anexos no cliente além do `accept` nativo já existente.

## Impact

- Dependências novas: `react-hook-form`, `@hookform/resolvers` (compatíveis com Zod 4).
- Código: `src/app/(public)/solicitar/request-form.tsx` (principal), possivelmente ajuste mínimo
  em `src/core/request/form.ts` se alguma mensagem precisar de refinamento por campo.
- Testes: e2e `e2e/service-request.spec.ts` ganha cenário de erro exibido sem round-trip;
  testes de unidade do schema já existentes continuam valendo.

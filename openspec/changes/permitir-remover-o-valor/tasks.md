## 1. Núcleo e persistência

- [x] 1.1 Ajustar `setRequestAmount` (`src/lib/service-request.ts`) para aceitar
      `amountCents: number | null` e gravar `null` quando for remoção.

## 2. Server action

- [x] 2.1 Adicionar em `setAmountAction` (`src/app/admin/(dashboard)/pedidos/[protocolo]/actions.ts`)
      um caminho para intent de remoção (ex.: campo `intent=clear`), pulando a validação de
      `parseCentsInput` e chamando `setRequestAmount(..., null)`.
- [x] 2.2 Confirmar que o e-mail de "valor a consultar" continua disparando só quando o valor
      anterior era `null` e o novo é informado (não disparar ao remover).

## 3. UI

- [x] 3.1 Em `amount-section.tsx`, adicionar botão "Remover valor" visível apenas quando o pedido
      já tem `amountCents` != null, submetendo o form com `intent=clear`.

## 4. Testes

- [x] 4.1 Teste de `setRequestAmount` cobrindo gravação de `null`.
- [x] 4.2 Teste de `setAmountAction` cobrindo o intent de remoção (sucesso e ausência de
      permissão).
- [x] 4.3 Teste (Playwright ou existente) confirmando que "Remover valor" some quando não há
      valor e volta a fila/detalhe para "—" após remoção.

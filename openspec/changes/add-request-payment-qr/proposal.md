## Why

O operador já pode informar o valor (`amountCents`) de um pedido de serviço, mas essa informação
para no painel: a mudança anterior (`add-admin-service-requests`) deixou deliberadamente de fora
a exibição ao cidadão, como trabalho futuro. Hoje quem tem um pedido "Aguardando pagamento" não
descobre quanto pagar nem como pagar pela consulta de protocolo — só ligando ou indo ao balcão.
A serventia já pode cadastrar sua chave Pix (`/admin/configuracoes/cobranca`), mas essa chave
também não é usada em lugar nenhum: nada gera cobrança a partir dela. Esta mudança fecha as duas
pontas: quando o valor é informado, o cidadão vê o valor e, se houver chave Pix cadastrada, um QR
code (e "Pix Copia e Cola") já com o valor fixado — sem precisar digitar nada na hora de pagar.

## What Changes

- Nova capacidade `pix-charge-qr`: gera o payload Pix EMV ("Copia e Cola") com valor fixo a partir
  da chave Pix da serventia, do valor do pedido e de um identificador curto do pedido (txid), e
  renderiza esse payload como QR code para exibição.
- O bloco "Chave Pix da serventia" (`/admin/configuracoes/cobranca`) ganha um campo obrigatório de
  "Cidade" (usado como Merchant City do payload Pix) — dado que a plataforma não coleta hoje em
  nenhuma outra tela.
- Capacidade `service-request` modificada: a consulta pública de protocolo passa a exibir o valor
  do pedido quando ele estiver informado. Com chave Pix cadastrada pela serventia, mostra também o
  QR code e o código "Copia e Cola"; sem chave, mostra só o valor com a instrução de pagar no
  balcão.
- O valor e o QR aparecem tanto na consulta "trancada" (sem a chave de acesso, resumo público) —
  já que valor e status de pagamento não identificam o requerente — quanto no detalhe completo
  (com a chave de acesso).

## Capabilities

### New Capabilities
- `pix-charge-qr`: geração do payload Pix EMV com valor fixo a partir da chave Pix da serventia, e
  renderização desse payload como QR code e como código "Copia e Cola" para exibição ao cidadão.

### Modified Capabilities
- `service-request`: a consulta pública de protocolo passa a exibir o valor do pedido e a forma de
  pagamento (QR/copia-e-cola ou instrução de pagar no balcão) quando o valor estiver informado,
  revertendo a decisão de ocultação tomada em `add-admin-service-requests`.

## Impact

- `src/core/tenant/schema.ts` e `src/core/tenant/overrides.ts`: novo campo `pix.city` (obrigatório
  quando há chave cadastrada).
- `src/app/admin/(dashboard)/configuracoes/cobranca/`: `pix-key-form.tsx` e `actions.ts` ganham o
  campo Cidade e sua validação.
- Novo módulo em `src/core` (ex.: `src/core/payment/pix-charge.ts`) para montar o payload EMV
  (incluindo CRC16), sem dependências externas — no mesmo espírito de `src/core/tenant/pix.ts`,
  que já implementa validação de CPF/CNPJ na mão.
- Nova dependência de runtime para desenhar o QR code a partir do payload (biblioteca a decidir em
  `design.md`) — transporte de apresentação, não regra de negócio.
- `src/app/(public)/protocolo/actions.ts` e `protocol-lookup.tsx`: `PublicStatus` e
  `ServiceRequestDetail` passam a carregar o valor e, quando aplicável, o payload Pix; novo bloco
  de UI de pagamento.
- Sem migração de banco: `pix` já é gravado dentro do JSONB de overrides do tenant
  (`tenant_content.published`/`draft`), então `city` entra como mais um campo validado pelo Zod
  schema existente, sem coluna nova.

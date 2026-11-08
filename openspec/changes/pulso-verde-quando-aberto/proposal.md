## Why

O pulso do cartão de horário da home era amarelo nos dois estados e fino demais para ser notado
de relance. A serventia quer a borda mais grossa e mais forte, e verde quando o balcão está
aberto, para a cor já dizer o estado antes da leitura.

## What Changes

- Pulso com borda mais grossa (3px, crescendo até 12px) e intensidade de 85%.
- Verde (`--palette-open`) com o balcão aberto; amarelo de atenção com o balcão fechado ou em
  intervalo. Uma animação só, com a cor vinda de `--hours-halo-color`.
- O ponto de status ao lado do texto fica verde quando aberto, combinando com o pulso.

## Não-objetivos

- Mudar o texto do status ou o cálculo de aberto/fechado.
- Pulso com movimento reduzido: continua parado.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `public-home`: cor do pulso conforme o estado do balcão.

## Impact

- `src/app/globals.css`: `--palette-open`, `--color-brand-open`, animação `hours-halo`.
- `src/app/(public)/page.tsx`: cor do pulso e do ponto pelo estado.

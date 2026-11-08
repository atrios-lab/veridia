## Why

Os feriados que já vêm da lei (nacionais e do Código de Normas do RN) eram fixos: a serventia via
a lista, mas não podia mexer. Alguns só valem em certos lugares, ou a cidade comemora em outra
data, e sem ajuste o site fechava a serventia num dia em que ela abre.

Junto, o pulso do cartão de horário da home ganha um amarelo de atenção, para ser notado sem
roubar o visual.

## What Changes

- Na seção "Feriados e dias sem expediente" do painel, cada dia da lei ganha:
  - **Não fecha aqui**: desliga esse feriado para a serventia, em todos os anos;
  - **Alterar**: desliga o da lei e traz para a lista da serventia com nome e data para editar
    (anual quando a data é fixa; data única quando segue a Páscoa);
  - **Voltar a considerar**: desfaz.
- `Tenant.disabledHolidays` (ids dos feriados da lei desligados), lido do mesmo override
  `office-holidays`. Linha antiga, sem o campo, mantém todos os feriados da lei.
- Todo cálculo de dia útil passa a receber `officeHolidays(tenant)` (próprios e desligados).
- Token `--palette-attention` (amarelo, igual em todo tema) e o pulso do cartão nele, a 75%.

## Não-objetivos

- Desligar um feriado só num ano específico. Desligar vale para todos os anos; para um ano só,
  desliga-se e volta depois, ou cadastra-se o dia próprio como data única.
- Mudar a lista do Código de Normas para todas as serventias. O ajuste é de cada uma.
- Apagar dados: desligar é um id numa lista de configuração, e "Voltar a considerar" o tira.
  Nenhuma migração.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `office-holidays`: a serventia pode desligar ou alterar os feriados da lei.

## Impact

- `src/core/scheduling/calendar.ts`: regras com id (`LAW_HOLIDAY_IDS`, `lawHolidays`,
  `upcomingLawHolidays`), `OfficeHolidays` vira `{ customHolidays, disabledHolidays }`,
  `officeHolidays()`.
- `src/core/tenant/{schema,overrides}.ts`: `disabledHolidays`.
- Telas e ações: `officeHolidays(tenant)` no lugar de `tenant.customHolidays`.
- `src/app/admin/(dashboard)/configuracoes/`: botões na lista da lei; payload com as duas listas.
- `src/app/globals.css`: `--palette-attention` e o pulso.

## Why

Na lista de feriados da lei, o painel oferecia "Alterar" e "Não fecha aqui", mas não "Excluir".
A serventia quer tirar de vez da lista um feriado que não vale na localidade. Se a exclusão foi
um engano, ou se uma lei nova criar o feriado, ela o cadastra de novo como seu, registrando a lei.

## What Changes

- Cada feriado da lei passa a ter três botões: **Alterar**, **Não fecha aqui** e **Excluir**.
  - "Não fecha aqui" segue como antes: fica na lista, riscado, com "Voltar a considerar".
  - "Excluir" tira o feriado da lista e da conta. O painel não guarda uma área de excluídos.
- Feriados cadastrados pela serventia ganham a caixa **Feriado por lei**, com o campo "Qual lei?"
  (`legalBasis`, opcional, até 120 caracteres; marcada, é obrigatória). É o caminho para
  recolocar um feriado excluído por engano ou criado por lei nova.
- O botão "Remover" dos feriados da serventia passa a se chamar "Excluir".
- `Tenant.hiddenHolidays` (ids dos feriados da lei excluídos), no mesmo override `office-holidays`.
  O calendário continua lendo só `disabledHolidays`; o painel grava os dois juntos.

## Não-objetivos

- Apagar regra da lei. Excluir é um id na configuração da serventia.
- Restaurar pelo painel um feriado da lei excluído. O caminho é cadastrá-lo como próprio.
- Migração de banco ou remoção de dado. Linha antiga, sem os campos novos, segue valendo.

## Capabilities

### New Capabilities

Nenhuma.

### Modified Capabilities

- `office-holidays`: excluir feriado da lei; feriado próprio com a lei que o cria.

## Impact

- `src/core/tenant/schema.ts`: `hiddenHolidays` e `legalBasis`; `src/core/tenant/overrides.ts`.
- `src/core/scheduling/calendar.ts`: `CustomHoliday.legalBasis`.
- `src/app/admin/(dashboard)/configuracoes/{office-holidays-form,page}.tsx`.

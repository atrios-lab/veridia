## 1. Núcleo

- [x] 1.1 Regras de feriado com id, `lawHolidays`, `upcomingLawHolidays`, `LAW_HOLIDAY_IDS`
- [x] 1.2 `OfficeHolidays` com `customHolidays` e `disabledHolidays`; `officeHolidays()`; `closedDays` sem os desligados
- [x] 1.3 `disabledHolidays` no `TenantSchema` (só ids conhecidos) e no `OfficeHolidaysSchema`

## 2. Telas

- [x] 2.1 Pontos de chamada passam `officeHolidays(tenant)`
- [x] 2.2 Painel: "Não fecha aqui", "Alterar" e "Voltar a considerar" na lista da lei; payload com as duas listas

## 3. Visual

- [x] 3.1 `--palette-attention` e o pulso do cartão em amarelo a 75%

## 4. Verificação

- [x] 4.1 Testes: desligar, alterar, Páscoa, ids únicos, override antigo, id desconhecido, status
- [x] 4.2 Bateria do CI
- [x] 4.3 Conferência no navegador: desligar, alterar, gravar, reabrir

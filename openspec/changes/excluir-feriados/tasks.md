## 1. Implementação

- [x] 1.1 `hiddenHolidays` no `TenantSchema` (só ids conhecidos) e no `OfficeHolidaysSchema`
- [x] 1.2 Botão "Excluir" ao lado de "Alterar" e "Não fecha aqui"; excluído sai da lista
- [x] 1.3 `legalBasis` no feriado próprio; caixa "Feriado por lei" com "Qual lei?"
- [x] 1.4 "Remover" dos feriados da serventia passa a "Excluir"

## 2. Verificação

- [x] 2.1 Testes do override e do schema (excluídos, lei registrada, lei em branco)
- [x] 2.2 Bateria do CI
- [x] 2.3 Conferência no navegador: excluir some da lista; feriado por lei com erro e gravação

## 1. Núcleo

- [x] 1.1 `codes.ts`: listas do ONR (311 tipos de logradouro, tipo de imóvel, registro, UF IBGE,
  situação do CNM).
- [x] 1.2 `cnm.ts`: dígito pelo módulo 97, leitura, conferência. Testes com CNMs do PGV.
- [x] 1.3 `acts.ts`: R/AV/M, numeração do art. 232, situação atual. Testes.
- [x] 1.4 `pendencies.ts`: arts. 337, 338, 339, CNM, Indicador Real, proprietário, com "Como
  fazer". Testes.
- [x] 1.5 `onr.ts`: lote CNM, Indicador Real, Indicador Pessoal, ISO-8859-1. Testes.
- [x] 1.6 `sheet.ts`: leitura da planilha do índice. Testes.

## 2. Banco e serviço

- [x] 2.1 Migração 0084 (só cria tabelas).
- [x] 2.2 `lib/ri.ts`: matrículas, atos, pessoas, importação, arquivos; histórico, apagar só
  marcando, auditoria. Testes com banco.
- [x] 2.3 Permissões `ri.view`, `ri.edit`, `ri.import`, `ri.export`; rótulos e níveis da auditoria.

## 3. Telas

- [x] 3.1 Sistema próprio em outra aba: barra, menu, Mesa do RI.
- [x] 3.2 Matrículas: lista, ficha, nova, alterar, apagar e restaurar; atos: lançar, alterar,
  apagar e restaurar.
- [x] 3.3 Pessoas, Indicador Real e Indicador Pessoal.
- [x] 3.4 Pendências e importação; CNM; Arquivos para a ONR; Configurações.
- [x] 3.5 Menu e guia de Atribuições abrem o sistema.

## 4. Verificação

- [x] 4.1 Navegador com dados fictícios, bateria completa, PR e merge.

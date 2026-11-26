## Why

A serventia pediu (25/11/2026) para exportar e importar as matrículas, e lançar numa planilha as que
for fazendo para trazer de volta ao sistema. Pediu também importar e exportar os indicadores, os
índices e os atos do Registro de Imóveis, em todos os formatos.

## What Changes

- Tela "Importar e exportar" no sistema de RI.
- Exportação em .xlsx, .csv e .json de: matrículas (todos os campos, Livros 2 e 3, com os
  proprietários atuais), atos (R/AV na numeração do art. 232, com partes, protocolo, selo e valor),
  pessoas, Indicador Real e Indicador Pessoal. A cópia do acervo (matrículas, atos e pessoas) sai num
  JSON só.
- Importação com conferência antes de salvar:
  - os mesmos arquivos;
  - o índice que a serventia já mantém em planilha;
  - o JSON do Indicador Real da ONR;
  - o XML do Banco Light (Indicador Pessoal);
  - o XML do lote de CNM.
- Nada é apagado nem substituído:
  - matrícula já cadastrada fica como está; se a serventia pedir, completam-se só os campos vazios,
    com histórico;
  - ato com número já lançado fica de fora;
  - a mesma pessoa é reconhecida pelo CPF/CNPJ.
- Exportar pede a permissão `ri.export` e importar, `ri.import`; os dois ficam na auditoria.
- A tela "Pendências e importação" passa a ser "Pendências da migração" e aponta para a nova tela.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- Banco: nenhuma migração.
- Código:
  - `src/core/ri/transfer.ts`
  - `src/lib/ri-transfer.ts`
  - `src/lib/ri-sheet.ts` (gravação de .xlsx e .csv; leitura de JSON e XML)
  - tela `/admin/ri/importar-exportar` e rota `/admin/ri/importar-exportar/baixar`

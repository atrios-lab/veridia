## Why

A serventia pediu (26/11/2026):
- anexar arquivos no Livro 3 e o sistema ler e extrair as informações, como já faz no Livro 2;
- transformar o documento em Markdown e descartar o original, para não ocupar espaço;
- campos de averbações e de anotações no Livro 3.

## What Changes

- **Ler de um arquivo no Livro 3:** em "Novo registro auxiliar" e na tela do registro, o arquivo
  (Word, PDF, foto ou texto) é lido pelo assistente virtual. Ele extrai:
  - natureza, número, título e emissão, partes e papéis;
  - valor, vencimento, praça e encargos;
  - garantias e local dos bens;
  - dados do pacto, protocolo e matrículas relacionadas;
  - averbações (como AV) e anotações.

  Sem o assistente, o sistema lê o texto pelos rótulos do modelo (TÍTULO, EMITENTE, CREDOR, VALOR,
  VENCIMENTO, GARANTIAS, PROTOCOLO, ANOTAÇÃO). A conferência vem antes de salvar, e na matrícula que
  já existe só os campos vazios são preenchidos.
- **"Guardar só o texto (Markdown) e descartar o arquivo":**
  - marcado de início no Livro 3 e disponível também no Livro 2;
  - o documento fica guardado em Markdown no banco e o original não fica no armazenamento;
  - "Abrir o texto (.md)" e "ler de novo" funcionam pelo texto guardado;
  - a auditoria registra o descarte.
- **Averbações à margem:** botão "Lançar averbação", com o formulário só de AV e naturezas próprias:
  aditivo, endosso ou cessão, prorrogação, troca de garantia, alteração de nome, baixa e
  cancelamento judicial (art. 250).
- **Anotações:**
  - lançar, editar (o texto anterior fica no histórico), apagar só ocultando, com justificativa, e
    restaurar;
  - cada uma vai para a auditoria;
  - aparecem na ficha e na planilha de importar e exportar;
  - o formulário do registro não as altera.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- Banco: nenhuma migração. As anotações ficam na coluna `aux`; o Markdown fica na leitura do
  anexo, em `ri_files.reading`.
- Código:
  - `src/core/ri/auxiliary-text.ts`, `auxiliary.ts`, `acts.ts`, `transfer.ts`;
  - `src/lib/ri-files.ts`, `ri.ts`;
  - telas de anexos, leitura, registro e ato.

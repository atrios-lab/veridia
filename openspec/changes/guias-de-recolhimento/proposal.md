## Why

O balcão de notas digita à mão, em Word, o requerimento de guia que a parte leva à Prefeitura (ITIV/ITBI,
laudêmio, certidão imobiliária) ou à SET/RN (ITCD) antes da escritura. Numeração, qualificação das partes,
alíquotas e fundamentos variavam de guia para guia.

## What Changes

- Novo grupo **Utilitários** no painel, com **Guias de recolhimento**:
  - tipos: ITIV/ITBI, ITCD por doação, ITCD causa mortis, laudêmio municipal e certidão imobiliária;
  - qualificação estruturada das partes (Lei 6.015, art. 176; CPC, art. 319, II), com a frase pronta;
  - ITCD do RN pela tabela da Lei 5.887/1989, art. 7º (Lei 9.993/2015);
  - tudo editável à mão: alíquota, imposto, destinatário, lei e número;
  - número por ano (001/2026); a lista fica separada por ano e por número;
  - excluir guia emitida por erro: sai da lista, o número fica livre e o registro fica guardado;
  - PDF com a identificação da serventia e Word editável; PDF com todas as guias do ano;
  - guarda de 12 meses, com lembrete para baixar e arquivar na nuvem da serventia;
  - quadro da SPU (terreno de marinha): laudêmio, CAT, prazo e multa, DOITU, com os links do gov.br.
- Configuração por serventia: lei e alíquota do ITIV, laudêmio, destinatários e quem assina.
- Fontes conferidas: `docs/guias-de-recolhimento.md`.
- **Banco: só acrescenta.** Migração `0038_guias_de_recolhimento`: tabela `tax_guides`.

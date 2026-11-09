## Why

O balcão de notas digita à mão, em Word, o requerimento de guia que a parte leva à Prefeitura (ITIV/ITBI,
laudêmio) ou à SET/RN (ITCD) antes da escritura. Numeração, qualificação das partes,
alíquotas e fundamentos variavam de guia para guia.

## What Changes

- Novo grupo **Utilitários** no painel, com **Guias de recolhimento**:
  - tipos: ITIV/ITBI, ITCD por doação, ITCD causa mortis e laudêmio municipal (a certidão de débitos do IPTU
    não é oferecida: o débito aparece quando o fisco gera o ITIV);
  - qualificação estruturada das partes (Lei 6.015, art. 176; CPC, art. 319, II), com a frase pronta;
  - ITCD do RN pela tabela da Lei 5.887/1989, art. 7º (Lei 9.993/2015);
  - tudo editável à mão: alíquota, imposto, destinatário, lei e número;
  - número por ano (001/2026); a lista fica separada por ano e por número;
  - excluir guia emitida por erro: sai da lista, o número fica livre e o registro fica guardado;
  - PDF com a identificação da serventia e Word editável; PDF com todas as guias do ano;
  - guarda de 12 meses, com lembrete para baixar e arquivar na nuvem da serventia;
  - quadro da SPU (terreno de marinha): laudêmio, CAT, prazo e multa, DOITU, com os links do gov.br.
- **Pedido pelo site** (Notas): o cliente informa as partes, o imóvel e o valor num formulário simples e
  anexa os documentos. A guia é gerada sozinha e fica só no painel. A serventia confere, corrige,
  assina e entrega a guia com o boleto pela consulta do protocolo, ou envia aos órgãos. Novo andamento:
  "Aguardando pagamento da guia".
- Configuração por serventia: lei e alíquota do ITIV, laudêmio, destinatários e quem assina.
- Fontes conferidas: `docs/guias-de-recolhimento.md`.
- **Banco: só acrescenta.** Migração `0038_guias_de_recolhimento`: tabela `tax_guides`.

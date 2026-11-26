## Why

A serventia quer que cada ficha assinada para a ONR já entre no acervo do Registro de Imóveis e vá montando o Livro 2 digital. É o mesmo arquivo que se imprime, e dele saem fichas, termos e indicadores. Os documentos guardados só em texto precisam voltar a abrir em PDF.

## What Changes

- **Ficha assinada vai para o acervo:** o assistente virtual lê a ficha assinada (só para conferir a matrícula) e compara com o que o sistema tem:
  - **matrícula nova** entra no acervo com os atos;
  - **ato com número de ordem novo** é **novo registro** ou **nova averbação**;
  - **ato já lançado com outro texto** é **retificação**; o texto antigo fica no histórico do ato.
  
  O funcionário vê o resumo e clica **"Aplicar ao acervo"**. Os indicadores real e pessoal saem do acervo, então já contam com a mudança.
- **Livro 2 aberto pela primeira ficha:** ao assinar a ficha da matrícula nº 1, sem Livro 2 aberto, o sistema propõe abri-lo a partir da matrícula 1, com o termo de abertura na **data da averbação de transporte** lida na ficha. Ele pergunta se é mesmo a data do 1º ato de transporte, e a data pode ser trocada.
  - Fontes: Lei nº 6.015/1973, arts. 4º, 6º e 173, parágrafo único; Código Nacional de Normas, art. 336.
  - Em "Livros e assinatura" continua dando para gerar os termos com a data que a serventia escolher.
- **Livro 2 digital = livro impresso:** no PDF do livro, a página de cada ficha assinada é a própria imagem enviada à ONR. Assinar de novo substitui a página, e a anterior vai para **"Alterações"**.
- **Ver em PDF:**
  - a imagem de cada ficha abre em PDF;
  - os documentos guardados só em texto (Livros 2, 3 e demais; o original é descartado) abrem e baixam em PDF reconstruído do Markdown, com a indicação do formato original. O texto `.md` continua disponível.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- **Banco:** a migração 0091 só acrescenta colunas a `ri_onr_images` (leitura, mudanças e quando foi aplicada). Nada é apagado.

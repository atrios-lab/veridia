## Why

Depois da fase 1, a serventia pediu (25/11/2026): voltar em todas as telas; o Livro 3 e o índice
dele; anexar documentos em tudo, inclusive a matrícula em Word, para o assistente virtual ler e
propor os dados; imprimir, assinar digitalmente ou sair com a imagem da assinatura de quem assina; e
a imagem da matrícula em TIFF preto e branco para a ONR.

## What Changes

- "Voltar" em todas as telas do sistema de RI e "Voltar ao painel" na barra.
- Livro 3 (Registro Auxiliar): tela própria com índice, natureza (Lei nº 6.015/1973, art. 178) e
  matrícula a que se refere; fora do Indicador Real e do arquivo do Indicador Pessoal da ONR, que
  só conhecem matrícula, matrícula-mãe e transcrição.
- Anexos na matrícula (ficha, título, documento), com envio direto ao armazenamento; apagar só
  marca.
- Leitura de Word, PDF ou foto: o assistente virtual lê a abertura e os atos; sem ele, a leitura do
  texto. Tela de conferência; só entram campos vazios e lançamentos marcados, cada um com o número
  da ficha.
- Ficha da matrícula em PDF: imprimir para assinar à mão, com a imagem da assinatura ou para o
  assinador digital; quem assina vem de "Quem assina".
- Imagem TIFF preto e branco (1 bit, CCITT G4, 300 dpi, uma página por folha) da ficha e das
  digitalizações anexadas.
- Quadro da integração com o PGV-CNM (API) e com o WS Ofício: o que falta para o envio direto.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- Banco: migração 0085 só acrescenta (tabela `ri_files`; colunas novas em `ri_properties` e
  `ri_settings`).
- Dependências: `sharp`, `fontkit`, `@fontsource/tinos` (fonte livre com as medidas da Times) para o
  TIFF.

## Why

A serventia ajeita a matrícula no Word e não quer imprimir e digitalizar para mandar à ONR. Na primeira tentativa, em 7/12/2023, enviou cópia reprográfica, e esse tipo de imagem não é aceito. A pasta do CSL2 está vazia. Por isso, as imagens do Livro 2 vão começar no padrão do manual "Matrícula Online – Imagens das matrículas" (v2.0).

## What Changes

- **"Assinar para exportar para a ONR"**, no Assinador e na matrícula, ao lado de "Assinar digitalmente". A assinatura digital continua facultativa.
  - **Entrada:** o funcionário anexa o **Word (.docx)** ou o **PDF** da matrícula, um ou vários de uma vez.
  - **Conferência:** o assistente virtual **só confere** se o número da matrícula, o CNM e a ordem dos atos batem com o acervo. Ele aponta as divergências e não muda o texto.
  - **Assinatura:** o sistema põe a imagem da assinatura de quem assina (RI › Configurações) na última folha, com o fundo limpo para o preto e branco. No Word, ela entra no lugar da assinatura, logo abaixo do último ato.
  - **Imagem:** a matrícula vira um TIFF preto e branco de 200 × 200 dpi, A4, compressão CCITT Group 4, multipágina, como pede o manual na seção 1.
  - **Nome e pasta:** seguem o padrão principal do manual (seção 2; Padrão 12): pasta de 8 dígitos por milhar e arquivo de 8 dígitos `.TIF`, por exemplo `00000000\00000001.TIF` e `00000001\00001234.TIF`.
- **Fila "Prontos para a ONR"**:
  - baixar um arquivo ou todos num `.zip`, já com as pastas;
  - marcar como copiado para a pasta do CSL2, desfazer a marcação e apagar só ocultando, com histórico.
- **"Como fazer"**, tirado dos manuais do CSL2 e da primeira carga: onde fica a pasta das matrículas, o horário do envio, as pastas "Processados" e "Erro", e o aviso de que cópia reprográfica não é aceita.
- **Padrão no formulário de envio:** o Padrão 12 vem marcado e pode ser trocado pelo Padrão 3 ou pelo 13 do manual, se a serventia precisar.
- **O TIFF da ficha gerada pelo sistema** passa de 300 para 200 dpi, como pede o manual.

## Capabilities

### Modified Capabilities
- `registro-de-imoveis`

## Impact

- **Banco:** só acrescenta (uma tabela para a fila de imagens).
- **Conversão:** do PDF para imagem no servidor, sem depender de programas instalados na máquina. Do Word, há duas rotas; a escolha está registrada no `design.md`.

## ADDED Requirements

### Requirement: Sistema próprio do Registro de Imóveis
Atribuições › Registro de Imóveis DEVE (SHALL) abrir em outra aba um sistema próprio, com barra, menu lateral e a Mesa do RI, para quem tem a permissão de consultar o Registro de Imóveis e numa serventia que exerce essa atribuição.

#### Scenario: Abrir o sistema
- **WHEN** a pessoa clica em Registro de Imóveis no menu de Atribuições
- **THEN** o sistema abre numa aba própria, na Mesa do RI, com as pendências, o CNM fora do PGV e o
  aviso do envio semanal do Indicador Real

### Requirement: Matrículas e atos
O sistema DEVE (SHALL) guardar cada matrícula com os dados do Indicador Real do ONR e o CNM, e os atos com a numeração única de registros e averbações (Lei nº 6.015/1973, art. 232), continuando a numeração da ficha. A situação atual (proprietários e ônus em vigor) DEVE (SHALL) ser calculada dos atos. Alterar DEVE (SHALL) guardar o valor anterior; apagar DEVE (SHALL) só marcar, com justificativa, sem reaproveitar o número do ato.

#### Scenario: Venda e cancelamento de hipoteca
- **WHEN** a ficha tinha 3 lançamentos e a funcionária lança uma compra e venda, uma hipoteca e o
  cancelamento da hipoteca
- **THEN** os atos são R-4, R-5 e AV-6, o adquirente é o proprietário e não há ônus em vigor

### Requirement: Pendências da migração
O sistema DEVE (SHALL) apontar as pendências do acervo com o passo a passo e a fonte: o mesmo número para imóveis diferentes (CNN, art. 338), possível duplicidade pelo CCIR, NIRF, CAR, Incra ou Sigef (art. 337), números sem matrícula (art. 339), CNM ausente ou que não confere (art. 330), dados que faltam ao Indicador Real e matrícula ativa sem proprietário.

#### Scenario: Número repetido
- **WHEN** a planilha traz duas linhas com a matrícula 5
- **THEN** as duas entram e a pendência do art. 338 aparece com o passo a passo

### Requirement: Importação da planilha do índice
O sistema DEVE (SHALL) ler a planilha do índice (.xlsx ou .csv) e mostrar o que leu, coluna por coluna, antes de salvar; o que já está no sistema NÃO DEVE (SHALL NOT) entrar de novo.

#### Scenario: Conferir e importar
- **WHEN** a pessoa envia a planilha e clica em Conferir
- **THEN** vê as matrículas lidas, as colunas reconhecidas e os avisos, e só então importa

### Requirement: Arquivos para a ONR
O sistema DEVE (SHALL) gerar e guardar, para a serventia importar com o certificado do oficial, o lote de CNM do PGV-CNM, o Indicador Real em JSON e o Indicador Pessoal em XML do Banco Light, dizendo o que ficou de fora e por quê. Nada DEVE (SHALL) ser enviado à ONR pelo sistema.

#### Scenario: Lote de CNM importado
- **WHEN** a pessoa gera o lote, importa no PGV-CNM e marca "Já importei na ONR"
- **THEN** as matrículas do lote passam a contar como cadastradas no PGV e saem do próximo lote

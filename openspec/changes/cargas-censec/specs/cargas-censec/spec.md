## ADDED Requirements

### Requirement: Leitura dos documentos anexados sem guardá-los
O painel DEVE (SHALL) receber vários arquivos de uma vez ou um PDF único com vários atos, separar os
atos, ler cada um e lançá-lo na central (CEP, CESDI ou RCTO) e na quinzena da data do ato, sem guardar
o arquivo, e DEVE (SHALL) mostrar o relatório com os arquivos enviados e lidos, os atos encontrados e
lançados e as pendências.

#### Scenario: PDF único com três atos
- **WHEN** a serventia envia um PDF com uma escritura, uma procuração e um testamento
- **THEN** três atos são lançados, dois no CEP e um no RCTO, e o arquivo não fica guardado

#### Scenario: PDF sem texto
- **WHEN** a serventia envia um PDF digitalizado como imagem
- **THEN** o relatório diz que não há texto e orienta lançar o ato à mão

### Requirement: Arquivos no leiaute oficial do CNB/CF
O painel DEVE (SHALL) gerar o JSON da quinzena no esquema da CENSEC (cabeçalho com o CNS e a
quinzena; atosCep, atosCesdi e testamentos), o XML de cada central como os exemplos do CNB/CF e o
TXT do CESDI e do RCTO, levando só os atos sem pendência.

#### Scenario: JSON conferido
- **WHEN** a serventia baixa o JSON de uma quinzena com atos completos
- **THEN** o arquivo não tem campo fora do esquema nem valor fora das tabelas da CENSEC

### Requirement: Prazo, fechamento e relatório da quinzena
O painel DEVE (SHALL) mostrar o prazo da quinzena (dia 20 para a 1ª, dia 5 do mês seguinte para a
2ª, ou o próximo dia útil), registrar o fechamento de cada central, positivo ou negativo, com a data e
o protocolo, e gerar o relatório da quinzena com quantos atos eram e quantos foram.

#### Scenario: Quinzena sem ato
- **WHEN** não há ato de uma central na quinzena
- **THEN** a tela oferece o registro do fechamento negativo, sem arquivo

### Requirement: Tudo editável e exclusão com justificativa
Cada ato DEVE (SHALL) poder ser editado em todos os campos e excluído com justificativa; a exclusão
DEVE (SHALL) só marcar o ato, com quem, quando e por quê.

#### Scenario: Excluir um ato
- **WHEN** a serventia exclui um ato com justificativa
- **THEN** ele sai da quinzena e dos arquivos e continua guardado com a justificativa

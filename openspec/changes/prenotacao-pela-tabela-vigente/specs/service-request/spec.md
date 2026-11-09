## ADDED Requirements

### Requirement: A prenotação é cobrada no pedido pela tabela vigente

Os atos de prenotação de Imóveis, Títulos e Documentos e Pessoas Jurídicas SHALL cobrar, no
pedido, o total do item de prenotação do respectivo registro na tabela de emolumentos vigente.
O formulário, a tela de sucesso e o requerimento SHALL dizer que o valor é a prenotação, citar
o código do item e o nome da tabela, e avisar que os emolumentos do ato (anotação, averbação, registro, retificação ou ratificação) são
calculados depois da análise. O formulário SHALL listar, para o cidadão escolher, as finalidades
anotação, averbação, registro, retificação e ratificação. O pedido SHALL gravar o valor no
protocolo. Sem valor na tabela
vigente, o formulário SHALL avisar que o valor é informado pela serventia no protocolo, e o
pedido SHALL seguir sem valor.

#### Scenario: Prenotação de Imóveis

- **WHEN** a tabela vigente tem a prenotação de Imóveis com código 2600103 e total R$ 57,90, e o cidadão escolhe "Prenotação para registro"
- **THEN** o formulário mostra "Prenotação: R$ 57,90 (código 2600103 da <tabela>)"
- **AND** o protocolo fica com R$ 57,90 a pagar e o requerimento traz a linha "Prenotação"

#### Scenario: Tabela nova

- **WHEN** o cartório publica uma tabela nova acima da anterior, com outro total
- **THEN** os pedidos seguintes cobram o total da tabela nova

#### Scenario: Pessoas Jurídicas

- **WHEN** a tabela vigente do RN traz 2400105 com total R$ 31,51 e o cidadão pede a prenotação de Pessoas Jurídicas para retificação
- **THEN** o formulário mostra "Prenotação: R$ 31,51 (código 2400105 da <tabela>)"

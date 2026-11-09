## ADDED Requirements

### Requirement: A prenotação é cobrada no pedido pela tabela vigente

Os atos de prenotação de Imóveis, Títulos e Documentos e Pessoas Jurídicas SHALL cobrar, no
pedido, o total do item de prenotação do respectivo registro na tabela de emolumentos vigente.
O formulário, a tela de sucesso e o requerimento SHALL dizer que o valor é a prenotação, citar
o código do item e o nome da tabela, e avisar que os emolumentos do registro ou da averbação são
calculados depois da análise. O pedido SHALL gravar o valor no protocolo. Sem valor na tabela
vigente, o formulário SHALL avisar que o valor é informado pela serventia no protocolo, e o
pedido SHALL seguir sem valor.

#### Scenario: Prenotação de Imóveis

- **WHEN** a tabela vigente tem a prenotação de Imóveis com código 2600103 e total R$ 57,90, e o cidadão pede a prenotação para registro
- **THEN** o formulário mostra "Prenotação: R$ 57,90 (código 2600103 da <tabela>)"
- **AND** o protocolo fica com R$ 57,90 a pagar e o requerimento traz a linha "Prenotação"

#### Scenario: Tabela nova

- **WHEN** o cartório publica uma tabela nova acima da anterior, com outro total
- **THEN** os pedidos seguintes cobram o total da tabela nova

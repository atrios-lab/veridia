## ADDED Requirements

### Requirement: Identificação da serventia nos documentos

Todo documento gerado pelo site SHALL trazer no cabeçalho o brasão da República e a identificação
da serventia (República Federativa do Brasil, serviço notarial e/ou registral, denominação oficial
e comarca ou termo), sem logomarca, e SHALL trazer no rodapé o endereço e os contatos. O nome do(a)
titular e as atribuições SHALL sair só quando a serventia marcar essa opção.

#### Scenario: Serventia que é termo de outra comarca

- **WHEN** a serventia configura "Comarca/Termo de" com a cidade sede Macaíba
- **THEN** o cabeçalho dos documentos traz "COMARCA/TERMO DE MACAÍBA/RN" e o requerimento é dirigido
  ao oficial do cartório com essa comarca

#### Scenario: Sem o nome do tabelião

- **WHEN** a serventia deixa desmarcado "Mostrar o nome do(a) titular"
- **THEN** o cabeçalho traz só a identificação, como no modelo de Ielmo Marinho

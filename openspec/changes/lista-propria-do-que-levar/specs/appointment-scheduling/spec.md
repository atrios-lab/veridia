## ADDED Requirements

### Requirement: O cidadão recebe a lista do cartório

Quando a serventia editou a lista de um serviço, o cidadão SHALL ver a lista editada em
todos os lugares. Quando anexou a lista própria, o site SHALL oferecer "Baixar a lista do
cartório para este serviço" ao escolher o serviço e na confirmação, e o e-mail e o
comprovante SHALL trazer o endereço do arquivo.

#### Scenario: Serviço com arquivo do cartório

- **WHEN** o cidadão escolhe um serviço com lista própria anexada
- **THEN** vê o link para baixar a lista do cartório, que abre o arquivo

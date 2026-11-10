## ADDED Requirements

### Requirement: Verificar documento assinado

O site SHALL permitir verificar um documento assinado pela serventia pelo código, pelo QR Code ou pelo próprio
PDF, mostrando quem assinou, quando e com qual certificado, e oferecendo o manifesto de assinaturas. O PDF
enviado para conferência SHALL ser comparado pelo hash calculado no aparelho do cidadão, sem envio do arquivo.
O arquivo assinado SHALL ficar disponível por 6 meses, e o registro da assinatura para sempre.

#### Scenario: Verificar pelo QR

- **WHEN** o cidadão lê o QR Code de um documento assinado
- **THEN** o site mostra o documento como autêntico, com os assinantes e o botão para baixar o manifesto

#### Scenario: Arquivo alterado

- **WHEN** o cidadão envia um PDF que não é idêntico a nenhum documento assinado pela serventia
- **THEN** o site diz que o arquivo não confere e indica o validador do ITI

#### Scenario: Depois de 6 meses

- **WHEN** alguém verifica um documento assinado há mais de 6 meses
- **THEN** o site ainda mostra o registro e o manifesto, sem o download do arquivo

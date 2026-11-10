## ADDED Requirements

### Requirement: Assinar o documento entregue

O painel SHALL avisar, na entrega ao cidadão, quando um PDF entregue não tem assinatura digital, e SHALL
oferecer assiná-lo pela plataforma com um certificado que o funcionário está autorizado a usar. Depois de
assinado, o cidadão SHALL baixar a versão assinada.

#### Scenario: Documento sem assinatura

- **WHEN** o funcionário entrega um PDF sem assinatura digital
- **THEN** o painel mostra o aviso "Sem assinatura digital" e o botão "Assinar pela plataforma"

#### Scenario: Assinar pela plataforma

- **WHEN** o funcionário assina o documento entregue com o certificado e a senha
- **THEN** o aviso some e o cidadão passa a baixar o PDF assinado, com o QR Code de verificação

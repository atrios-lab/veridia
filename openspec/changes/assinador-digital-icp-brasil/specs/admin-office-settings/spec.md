## ADDED Requirements

### Requirement: Certificados A1 e assinador digital

O painel SHALL permitir ao administrador cadastrar vários certificados A1 (e-CPF e e-CNPJ) e autorizar quem
assina com cada um. A senha do certificado SHALL ser digitada a cada assinatura e nunca guardada. A assinatura
SHALL seguir o padrão PAdES com a política AD-RB da ICP-Brasil, e cada página SHALL receber a faixa de
assinatura e o QR Code de verificação.

#### Scenario: Senha errada

- **WHEN** o funcionário autorizado tenta assinar com a senha errada do certificado
- **THEN** o documento não é assinado e o painel diz que a senha está incorreta

#### Scenario: Sem autorização

- **WHEN** um funcionário não autorizado tenta assinar com um certificado
- **THEN** o painel recusa a assinatura

#### Scenario: Coassinatura

- **WHEN** um segundo funcionário assina um documento já assinado na plataforma
- **THEN** o documento passa a ter as duas assinaturas, e a primeira continua válida

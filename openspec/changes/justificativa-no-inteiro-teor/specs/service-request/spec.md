## ADDED Requirements

### Requirement: Motivo do pedido em toda certidão de inteiro teor
Todo pedido de certidão de inteiro teor DEVE (SHALL) pedir, no site e no balcão, o motivo do pedido, com um aviso de que a certidão pode trazer dados pessoais sensíveis e de que a serventia analisa o motivo antes de emitir. Valem como inteiro teor: o verbum ad verbum do RCPN, salvo no óbito; a opção de inteiro teor digital e o ato em papel de segurança de imóveis; a opção de inteiro teor das certidões do RTD e do RCPJ; a certidão de testamento de Notas; e a gratuidade do RCPN com o tipo de certidão inteiro teor, salvo no óbito.

As certidões resumidas SHALL NOT perguntar o motivo, e o servidor DEVE (SHALL) recusar o motivo enviado num pedido que não o pergunta. O motivo DEVE (SHALL) sair no detalhe do pedido e no requerimento em PDF, com o rótulo "Motivo do pedido".

#### Scenario: Inteiro teor de imóveis sem motivo
- **WHEN** o cidadão pede a certidão de inteiro teor digital ou em papel de segurança sem informar o motivo
- **THEN** o pedido é recusado com erro junto ao campo

#### Scenario: Matrícula não pergunta o motivo
- **WHEN** o cidadão escolhe a certidão de matrícula ou de ônus
- **THEN** o formulário não mostra o campo, e o servidor recusa um motivo enviado

#### Scenario: RTD e RCPJ separam breve relato e inteiro teor
- **WHEN** o cidadão abre a certidão do registro do RTD ou do RCPJ
- **THEN** ele escolhe entre breve relato e inteiro teor, e só o inteiro teor pede o motivo

#### Scenario: Certidão de testamento
- **WHEN** o cidadão escolhe a certidão de testamento em Notas
- **THEN** o formulário pede o motivo, e a certidão de escritura, procuração ou ata não pede

#### Scenario: Gratuidade com inteiro teor
- **WHEN** o cidadão pede gratuidade para a certidão de nascimento e marca o tipo inteiro teor
- **THEN** o campo do motivo aparece no bloco da gratuidade e é obrigatório

#### Scenario: Gratuidade com inteiro teor de óbito
- **WHEN** o cidadão pede gratuidade para a certidão de óbito em inteiro teor
- **THEN** o motivo não é pedido

#### Scenario: Troca para uma certidão resumida
- **WHEN** o cidadão preenche o motivo no inteiro teor e troca para a matrícula
- **THEN** o campo some, o valor é apagado, e o pedido pode ser enviado

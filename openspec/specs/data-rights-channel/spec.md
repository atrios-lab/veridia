# data-rights-channel

## Purpose

TBD
## Requirements
### Requirement: Direitos do titular em primeira pessoa

O canal LGPD SHALL apresentar os direitos como escolha única em linguagem de titular ("Ver quais
dados vocês têm sobre mim"), com o nome jurídico do direito e sua consequência como subtítulo.
O titular MUST NOT precisar reconhecer o termo legal para escolher. A lista SHALL cobrir acesso,
correção, exclusão e uma opção aberta para os demais direitos e dúvidas.

#### Scenario: Consequência declarada junto da escolha

- **WHEN** o titular lê a opção de exclusão
- **THEN** o subtítulo informa que atos registrais têm guarda obrigatória por lei
- **AND** a opção de correção informa que a correção alcança o cadastro, não o registro público

#### Scenario: Direito é obrigatório

- **WHEN** o formulário é enviado sem direito escolhido
- **THEN** o pedido não é gravado e o campo é apontado como obrigatório

### Requirement: Prazo legal declarado antes do envio

O prazo legal de 15 dias da Lei 13.709/2018 SHALL aparecer na página do formulário, junto do
direito escolhido, antes de qualquer envio — e não apenas na confirmação.

#### Scenario: Prazo visível no formulário

- **WHEN** a página do canal LGPD é exibida
- **THEN** o prazo de 15 dias aparece na introdução e no subtítulo do direito escolhido

### Requirement: Encarregado de dados publicado sem roubar a dobra

O nome e o contato institucional do Encarregado (DPO) da serventia SHALL estar publicados na
página, vindos da configuração da serventia. No celular SHALL ser uma linha compacta acima do
formulário; no desktop, cartão na coluna lateral com o contato e a referência ao art. 41, §3º
da LGPD.

#### Scenario: Serventia distinta, DPO distinto

- **WHEN** a página é servida para outra serventia
- **THEN** o nome e o e-mail exibidos são os do Encarregado daquela serventia, sem alteração de
  código

### Requirement: Requerimento do titular com identificação e declaração

O formulário SHALL pedir nome completo, e-mail, CPF opcional, a descrição do pedido e a
declaração de que quem envia é o titular ou seu representante legal, e SHALL aceitar anexo
opcional de identidade ou procuração. A declaração SHALL ser obrigatória. O formulário SHALL
usar campo-armadilha invisível e MUST NOT usar CAPTCHA.

#### Scenario: Envio válido gera protocolo SOL e chave

- **WHEN** o titular envia direito, nome, e-mail, descrição e a declaração marcada
- **THEN** o requerimento é gravado com protocolo `SOL.AAAA.NNNNNN`, sequência própria do tipo
  por serventia e ano, e a chave de acesso é exibida uma única vez, armazenada apenas como hash

#### Scenario: Declaração não marcada

- **WHEN** a declaração de titularidade não é marcada
- **THEN** o requerimento não é gravado e o aceite é apontado como obrigatório

### Requirement: Confirmação com data limite calculada

A confirmação SHALL mostrar o direito escolhido, o protocolo e a chave em destaque, a data
limite de resposta calculada a partir da data do pedido, o progresso do prazo e o recibo do
requerimento em PDF.

#### Scenario: Data limite

- **WHEN** o requerimento é registrado
- **THEN** a confirmação exibe a data limite correspondente a 15 dias contados da data do
  pedido, com o dia corrente identificado como dia 1 de 15

#### Scenario: Recibo protegido

- **WHEN** o recibo em PDF é pedido sem a chave correta
- **THEN** o download é recusado

### Requirement: Resposta do Encarregado protegida por chave

O **texto** da resposta do Encarregado SHALL aparecer somente na consulta por protocolo e chave,
nunca por outro canal, e a consulta SHALL exibir o autor, a data da resposta, o texto e o
andamento com o dia do prazo em que foi respondida.

Registrada a resposta, o site SHALL avisar o titular no e-mail que ele informou no requerimento.
O aviso SHALL dizer apenas que há resposta, com o número do protocolo e o atalho para a consulta;
o texto da resposta e qualquer dado pessoal do requerimento MUST NOT viajar no e-mail.

#### Scenario: Resposta lida na consulta

- **WHEN** o titular consulta com protocolo e chave e há resposta registrada
- **THEN** o texto da resposta, o nome do Encarregado, a data e o andamento aparecem
- **AND** a página afirma que a resposta só aparece para quem tem protocolo e chave

#### Scenario: Titular avisado de que foi respondido

- **WHEN** o Encarregado registra a resposta de um requerimento
- **THEN** o titular recebe no e-mail do requerimento um aviso com o protocolo e o atalho para a
  consulta, sem o texto da resposta

#### Scenario: Falha no envio não desfaz a resposta

- **WHEN** o provedor de e-mail recusa ou não responde no momento do envio
- **THEN** a resposta continua gravada e visível na consulta, e a falha fica apenas no log da
  aplicação


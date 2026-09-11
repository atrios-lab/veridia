## ADDED Requirements

### Requirement: Download do PDF de indeferimento na consulta de protocolo

A consulta pública de protocolo SHALL exibir um botão de download do PDF quando um pedido
estiver "Indeferido" e tiver um PDF anexado à mudança de andamento, junto ao selo do andamento e
ao texto do motivo (quando também houver). O download SHALL usar o mesmo mecanismo autenticado por
chave de acesso (envio por formulário POST, sem a chave na URL) já usado para os demais anexos do
pedido nessa tela. O e-mail de aviso de indeferimento NÃO SHALL carregar o PDF nem um link direto
para ele: o cidadão SHALL precisar acessar a consulta pública com a chave de acesso para baixá-lo.

#### Scenario: PDF disponível para download
- **WHEN** o cidadão consulta um protocolo indeferido que tem um PDF anexado
- **THEN** a consulta mostra o selo "Indeferido" e um botão para baixar o PDF

#### Scenario: Indeferimento sem PDF não mostra botão de download
- **WHEN** o cidadão consulta um protocolo indeferido sem PDF anexado, só com o motivo em texto
- **THEN** a consulta mostra o texto do motivo e nenhum botão de download aparece

#### Scenario: E-mail de indeferimento não leva o PDF
- **WHEN** um pedido com PDF anexado é indeferido e o contato é e-mail
- **THEN** o e-mail avisa que o pedido foi indeferido, sem anexar o PDF nem incluir link direto
  para ele

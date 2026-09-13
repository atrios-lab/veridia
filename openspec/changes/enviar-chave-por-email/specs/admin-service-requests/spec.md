## REMOVED Requirements

### Requirement: Emitir nova chave de acesso
**Reason**: A chave nova em claro no painel obrigava o operador a copiá-la e repassá-la por
conta própria (WhatsApp, telefone), expondo a credencial do cidadão e fazendo da serventia um
balcão de senha.
**Migration**: A recuperação passa a ser do cidadão, na consulta de protocolo do site
("Perdi a chave de acesso"): a chave nova é enviada ao e-mail do pedido sem passar pelo painel.
O painel só informa isso e permite corrigir o contato de um pedido que tenha telefone no lugar
do e-mail.

## ADDED Requirements

### Requirement: A seção da chave no detalhe só orienta

O detalhe do pedido SHALL mostrar desde quando a chave de acesso vigente vale e orientar que o
cidadão recupera a chave pelo site, na consulta de protocolo, com o e-mail do pedido. Quando o
contato do pedido não é um e-mail, a seção SHALL orientar o operador a atualizar o contato para
um e-mail, pela edição de dados que já existe. NÃO SHALL existir no detalhe ação que gere,
mostre ou envie a chave.

#### Scenario: Pedido com e-mail
- **WHEN** o operador abre o detalhe de um pedido cujo contato é "maria@exemplo.com"
- **THEN** a seção da chave informa a data de emissão e que a recuperação é feita pelo cidadão
  no site, sem botão de emissão e sem texto no padrão da chave

#### Scenario: Pedido com telefone
- **WHEN** o operador abre o detalhe de um pedido lançado no balcão com contato "(84) 99999-0000"
- **THEN** a seção orienta a atualizar o contato para um e-mail para o cidadão poder recuperar a
  chave

#### Scenario: Recuperação pelo cidadão aparece no histórico
- **WHEN** o cidadão recupera a chave pelo site
- **THEN** o histórico do detalhe mostra "Cidadão recuperou a chave de acesso pelo site" com a
  data

## MODIFIED Requirements

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo,
mantendo a geração como ação secundária ("Gerar sem assinatura"). Vale o anexo mais recente do
documento. NÃO DEVE (SHALL NOT) existir caminho no detalhe do pedido que produza a chave de
acesso em claro, nem o comprovante de acesso: a chave chega ao cidadão só por e-mail. O
comprovante de acesso continua sendo emitido apenas no lançamento do pedido no balcão, onde o
cidadão está presente.

Em pedido com gratuidade, o detalhe DEVE (SHALL) oferecer também a declaração de
hipossuficiência preenchida (Anexo I do Provimento CGJ/TJRN n. 7/2026), pela mesma sessão, com
o mesmo conteúdo do arquivo que o cidadão baixa, registrada na auditoria; e, quando o pedido tem
a declaração assinada anexada, a ação DEVE (SHALL) apresentar-se como via assinada e abrir esse
arquivo, com a geração como secundária, pela mesma regra do requerimento. O painel DEVE (SHALL)
oferecer ainda o formulário em branco, para entregar a quem preenche à mão.

Abrir uma via assinada pelo painel DEVE (SHALL) ser registrado na auditoria como a geração é,
nomeando o documento (requerimento ou declaração) e o pedido.

A seção de anexos do detalhe DEVE (SHALL) permitir ao operador marcar um arquivo que anexa como
"requerimento assinado" ou "declaração assinada", para que o papel assinado à mão no balcão e
digitalizado conte como via assinada.

#### Scenario: Folha para assinar no balcão
- **WHEN** o operador aciona a impressão num pedido sem requerimento assinado
- **THEN** recebe o requerimento em PDF do pedido, sem chave de acesso em página nenhuma

#### Scenario: Via assinada quando ela existe
- **WHEN** o pedido tem um requerimento assinado devolvido pelo cidadão
- **THEN** a ação principal é "Requerimento assinado" e abre o arquivo anexado; "Gerar sem
  assinatura" continua gerando o PDF novo

#### Scenario: Declaração assinada quando ela existe
- **WHEN** o pedido tem a declaração assinada devolvida pelo cidadão
- **THEN** a ação principal é "Declaração assinada" e abre o arquivo; "Gerar sem assinatura"
  continua gerando a declaração preenchida com o carimbo

#### Scenario: Reenvio prevalece
- **WHEN** o pedido tem dois requerimentos assinados anexados
- **THEN** a ação abre o mais recente

#### Scenario: Abrir a via assinada deixa rastro
- **WHEN** o operador abre a via assinada do requerimento ou da declaração
- **THEN** a auditoria registra a ação nomeando o documento, no histórico do pedido

#### Scenario: Papel do balcão vira via assinada
- **WHEN** o operador anexa um arquivo marcando "requerimento assinado"
- **THEN** o cabeçalho do detalhe passa a oferecer "Requerimento assinado" abrindo esse arquivo

#### Scenario: O detalhe não emite comprovante
- **WHEN** o operador abre o detalhe de qualquer pedido
- **THEN** não há comprovante de acesso nem chave em claro; o comprovante só existe na tela de
  lançamento do balcão

#### Scenario: Rota autenticada por sessão
- **WHEN** a rota de impressão é chamada sem sessão com `requests.manage`
- **THEN** a resposta nega o acesso, sem gerar documento

### Requirement: Recibo por e-mail do pedido lançado no balcão

Quando o pedido é lançado manualmente e o contato registrado é um e-mail, o cidadão SHALL
receber um recibo com o número do protocolo e a chave de acesso, com a orientação de guardar a
mensagem; a chave NÃO SHALL constar do assunto nem de link. O envio SHALL ser fire-and-forget:
falha de e-mail nunca falha o lançamento, e a tela do balcão continua mostrando protocolo e
chave e oferecendo o comprovante impresso.

#### Scenario: Recibo enviado com a chave
- **WHEN** o operador lança um pedido com contato "joao@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o protocolo e a chave no corpo

#### Scenario: Contato é telefone
- **WHEN** o operador lança um pedido com contato "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o pedido é lançado normalmente, com a chave na tela e no
  comprovante

### Requirement: Avisos por e-mail nas ações que afetam o cidadão
Ações do operador que mudam o que o cidadão vê SHALL disparar aviso por e-mail quando o contato
do pedido for um e-mail: exigência registrada, pedido concluído, pedido cancelado, documento de
entrega disponível, valor do pedido informado pela primeira vez e formulário anexado a uma
exigência. O aviso NÃO SHALL carregar o conteúdo (texto da exigência, arquivo, valor) nem a
chave de acesso: apenas o protocolo e a instrução de consultar com a chave. A chave SHALL
viajar por e-mail somente nas mensagens cuja função é entregá-la: a confirmação do protocolo e
a recuperação pedida pelo cidadão no site. O envio SHALL ser fire-and-forget: falha de e-mail
nunca falha a ação.

#### Scenario: Exigência registrada avisa
- **WHEN** o operador registra uma exigência num pedido cujo contato é e-mail
- **THEN** chega um aviso "há uma exigência no seu pedido", sem o texto da exigência e sem a chave

#### Scenario: Conclusão avisa
- **WHEN** o operador muda o andamento para "Concluído"
- **THEN** chega um aviso de conclusão ao contato

#### Scenario: Entrega avisa
- **WHEN** o operador anexa um documento de entrega
- **THEN** chega um aviso "há um documento disponível no seu pedido", sem o arquivo

#### Scenario: Valor informado pela primeira vez avisa
- **WHEN** o operador informa o valor num pedido que ainda não tinha valor
- **THEN** chega um aviso de que o pedido tem valor a consultar, sem o valor no corpo

#### Scenario: Correção de valor não reavisa
- **WHEN** o operador corrige um valor já informado
- **THEN** nenhum e-mail é enviado

#### Scenario: Formulário de exigência avisa
- **WHEN** o operador anexa um formulário a uma exigência de um pedido cujo contato é e-mail
- **THEN** chega um aviso de que há um formulário para imprimir, sem o arquivo

#### Scenario: Andamento intermediário não avisa
- **WHEN** o operador muda o andamento para "Prenotado"
- **THEN** nenhum e-mail é enviado: o cidadão acompanha pela consulta, e avisar cada passo viraria ruído

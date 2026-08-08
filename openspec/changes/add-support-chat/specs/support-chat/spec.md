## ADDED Requirements

### Requirement: Botão flutuante segue o interruptor e o horário da serventia

O site público SHALL exibir um botão flutuante "Atendimento online" em qualquer página quando a
serventia está com o chat ligado (ver `admin-support-chat`, interruptor "Disponível para o chat")
e o instante atual, no fuso `America/Sao_Paulo`, cai dentro do horário de atendimento configurado
(`tenant.scheduling`, dias úteis). O botão MUST NOT aparecer quando a serventia desliga o chat,
independentemente do horário.

#### Scenario: Chat ligado e no horário
- **WHEN** a serventia está com o chat ligado e são 10h de uma terça-feira, dentro da janela
  configurada
- **THEN** o botão flutuante aparece em qualquer página pública

#### Scenario: Serventia desligou o chat
- **WHEN** a serventia está com o chat desligado, mesmo dentro do horário de atendimento
- **THEN** o botão flutuante não aparece em nenhuma página

### Requirement: Contador de mensagens não lidas no botão

O botão flutuante SHALL exibir um contador com a quantidade de mensagens não lidas quando o
cidadão tem uma conversa em andamento com mensagens que ainda não abriu.

#### Scenario: Mensagem chega com o widget fechado
- **WHEN** o atendente envia uma mensagem e o cidadão não tem o painel do widget aberto
- **THEN** o contador no botão flutuante aumenta em um
- **AND** o contador zera quando o cidadão abre o painel e vê as mensagens

### Requirement: Aparência fora do horário é neutra, sem fila nem contador

Fora do horário de atendimento, com o chat ligado pela serventia, o botão SHALL trocar para uma
aparência neutra rotulada "Fora do horário de atendimento", sem o contador de não lidas e sem
abrir para uma fila.

#### Scenario: Botão fora do horário
- **WHEN** a serventia está com o chat ligado, mas o instante atual cai fora da janela de
  atendimento
- **THEN** o botão mostra "Fora do horário de atendimento" em vez do rótulo padrão, sem badge

### Requirement: Pré-chat obrigatório antes da fila

Antes de entrar na fila, o widget SHALL exigir nome completo, um contato (e-mail ou telefone) e um
assunto. O formulário SHALL usar campo-armadilha invisível contra robô e MUST NOT usar CAPTCHA. A
sondagem de envio SHALL respeitar o mesmo limite de taxa por IP já aplicado aos outros canais
públicos.

#### Scenario: Pré-chat incompleto
- **WHEN** o cidadão tenta entrar na fila sem nome, sem contato ou sem assunto
- **THEN** a conversa não é criada e o campo faltante é apontado como obrigatório

#### Scenario: Campo-armadilha preenchido
- **WHEN** o campo invisível do pré-chat chega preenchido
- **THEN** a tela avança normalmente para a fila, mas nenhuma conversa é gravada

### Requirement: Protocolo opcional é localizado no pré-chat

O pré-chat SHALL oferecer um campo opcional de protocolo. Quando o cidadão informa um valor que
corresponde a um pedido existente da mesma serventia, o pré-chat SHALL confirmar "Pedido
localizado" antes do envio; um valor que não corresponde a nenhum pedido SHALL ser aceito mesmo
assim, sem bloquear a entrada na fila.

#### Scenario: Protocolo existente
- **WHEN** o cidadão digita o número de um pedido de serviço já registrado nesta serventia
- **THEN** o pré-chat mostra "Pedido REQ.AAAA.NNNNNN localizado" antes do cidadão enviar

#### Scenario: Protocolo não encontrado não bloqueia
- **WHEN** o cidadão digita um número que não corresponde a nenhum pedido da serventia
- **THEN** o pré-chat aceita o envio normalmente, sem a confirmação de localização

### Requirement: Fila mostra posição, estimativa e permite desistir

Enquanto a conversa está em espera, o widget SHALL mostrar a posição do cidadão na fila e uma
estimativa de tempo, e SHALL oferecer "Desistir da espera", que encerra a conversa sem atribuí-la
a ninguém.

#### Scenario: Posição na fila
- **WHEN** o cidadão é o segundo a esperar por atendimento
- **THEN** o widget mostra "Você é o 2º da fila" com uma estimativa de tempo

#### Scenario: Desistência
- **WHEN** o cidadão aciona "Desistir da espera"
- **THEN** a conversa é encerrada sem atendente, e some da fila do painel

### Requirement: Conversa mostra quem atende e aceita anexo

Durante a conversa, o widget SHALL mostrar o nome e o setor de quem está atendendo (quando o
atendente tem setor atribuído) e SHALL permitir enviar anexos com as mesmas regras de tipo e
tamanho já aplicadas aos anexos de pedido. Notas internas MUST NOT aparecer neste lado, em nenhuma
circunstância.

#### Scenario: Identificação do atendente
- **WHEN** um atendente assume a conversa
- **THEN** o cabeçalho do widget passa a mostrar o nome dele e, se atribuído, o setor

#### Scenario: Nota interna nunca aparece ao cidadão
- **WHEN** o atendente registra uma nota interna durante a conversa
- **THEN** a mensagem não aparece em nenhum momento no widget do cidadão, nem antes nem depois de
  uma transferência

### Requirement: Transferência vira aviso de sistema

Quando uma conversa é transferida para outro atendente, o widget SHALL inserir uma mensagem de
sistema informando o nome e o setor de quem passa a atender, sem expor o motivo interno da
transferência.

#### Scenario: Aviso de transferência
- **WHEN** um atendente transfere a conversa para outro
- **THEN** o widget mostra "Você foi transferido para {nome}, do {setor}" como mensagem de sistema

### Requirement: Inatividade avisa e encerra automaticamente

Uma conversa `active` sem mensagem do cidadão SHALL exibir o aviso "Ainda está aí?" depois de um
período de inatividade e SHALL ser encerrada automaticamente, com mensagem de sistema, se o
cidadão não responder dentro de 10 minutos desde a última mensagem dele.

#### Scenario: Encerramento por inatividade
- **WHEN** passam 10 minutos sem mensagem do cidadão numa conversa `active`
- **THEN** a conversa passa a `closed` com motivo de inatividade na próxima leitura, e uma
  mensagem de sistema registra o encerramento

### Requirement: Fora do horário, sem recado, com canais alternativos

Fora do horário de atendimento (ou com o chat desligado), o widget SHALL mostrar quando o
atendimento volta e os canais que funcionam sem depender de alguém responder em tempo real
(e-mail, consulta de protocolo, agendamento). O widget MUST NOT aceitar mensagem nem abrir uma
conversa nesse estado.

#### Scenario: Tela fechada
- **WHEN** o cidadão abre o widget fora do horário de atendimento
- **THEN** a tela mostra quando o atendimento volta e os atalhos para e-mail, consulta de
  protocolo e agendamento, sem campo de mensagem

### Requirement: Encerramento oferece avaliação e preferência de transcrição

Ao encerrar, o widget SHALL oferecer avaliação por estrelas (1 a 5) com comentário opcional, e a
opção de marcar preferência por receber a transcrição por e-mail. A conversa encerrada SHALL ficar
retida por 6 meses.

#### Scenario: Avaliação registrada
- **WHEN** o cidadão envia uma avaliação de 4 estrelas com comentário ao final do atendimento
- **THEN** a nota e o comentário ficam gravados na conversa, visíveis ao atendente

#### Scenario: Preferência de transcrição é só um registro
- **WHEN** o cidadão marca "Receber a transcrição por e-mail" ao encerrar
- **THEN** a preferência é gravada na conversa; nenhum e-mail é efetivamente enviado por este
  sistema

# Admin Service Requests — delta

## MODIFIED Requirements

### Requirement: Mudar o andamento a partir do detalhe

O detalhe SHALL mostrar o andamento atual e oferecer, como sugestão, os andamentos alcançáveis a
partir dele. O operador SHALL poder, além da sugestão, escolher qualquer um dos dezoito
andamentos válidos, que cobrem o fluxo registral que a serventia já usa em produção: Novo, Em
análise, Aguardando pagamento, Pago, Protocolado, Prenotado, Em qualificação, Com exigência,
Aguardando exigência, Em processamento, Registrado, Averbado, Deferido, Disponível para
retirada, Concluído, Indeferido, Cancelado, Arquivado. O fluxo é livre de propósito (o andamento
de um título não cabe numa máquina de estados; quem decide é o registrador): o servidor SHALL
aceitar qualquer valor da lista fechada de dezoito, SHALL recusar qualquer outro e SHALL recusar
a transição para o mesmo andamento. Toda mudança SHALL gravar entrada no histórico do pedido. Na
fila, onde dezoito não cabem numa barra de progresso, o andamento SHALL ser apresentado colapsado
em fases.

#### Scenario: Transição sugerida

- **WHEN** o pedido está em "Em análise"
- **THEN** a tela oferece os próximos andamentos curados daquele ponto como sugestão direta

#### Scenario: Andamento registral disponível

- **WHEN** o operador precisa marcar um título como "Prenotado"
- **THEN** a lista completa oferece o andamento e o servidor o aceita

#### Scenario: Correção manual fora da sugestão

- **WHEN** o operador precisa corrigir um pedido de "Cancelado" de volta para "Em análise"
- **THEN** a mudança é aceita, mesmo não sendo uma das sugestões diretas daquele andamento

#### Scenario: Valor inválido é recusado

- **WHEN** uma requisição tenta gravar um andamento fora dos dezoito valores válidos
- **THEN** o servidor recusa e o andamento do pedido não muda

#### Scenario: Dados existentes continuam válidos

- **WHEN** a lista passa de oito para dezoito
- **THEN** todo pedido já gravado continua com andamento válido, pois os oito anteriores
  permanecem na lista sem renomeação

#### Scenario: Outros canais não são afetados

- **WHEN** a lista de andamentos do pedido cresce
- **THEN** agendamento, LGPD e ouvidoria seguem com os seus próprios andamentos, apesar de
  compartilharem a mesma coluna de status

### Requirement: Registrar exigência a partir do detalhe

O operador SHALL poder registrar uma exigência (texto livre) num pedido. A exigência registrada
SHALL aparecer de imediato na consulta de protocolo do cidadão. Marcar a exigência como cumprida
SHALL ser ação exclusiva do operador: o envio do cidadão (arquivo ou mensagem na conversa) NÃO
SHALL marcá-la cumprida por si. Enquanto pendente, a exigência SHALL poder ser editada (texto) e
excluída pelo operador — a exclusão remove a exigência, sua conversa e seus arquivos, atrás da
confirmação padrão do painel e com registro em auditoria. Exigência cumprida SHALL ser imutável:
sem edição, sem exclusão, conversa encerrada.

#### Scenario: Exigência aparece assim que registrada

- **WHEN** o operador registra "Falta cópia legível do documento de identidade"
- **THEN** a consulta de protocolo daquele pedido já mostra a exigência pendente, sem precisar de
  outra ação

#### Scenario: Envio do cidadão não cumpre sozinho

- **WHEN** o cidadão envia o documento pela consulta de protocolo
- **THEN** a exigência continua pendente, com o envio visível na conversa, até o operador conferir
  e marcá-la cumprida

#### Scenario: Operador marca cumprida

- **WHEN** o operador confere o envio e marca a exigência como cumprida
- **THEN** a exigência aparece cumprida nos dois lados, com a data, e a conversa encerra

#### Scenario: Editar exigência pendente

- **WHEN** o operador corrige o texto de uma exigência ainda pendente
- **THEN** o novo texto aparece nos dois lados

#### Scenario: Excluir exigência pendente

- **WHEN** o operador exclui uma exigência registrada por engano e confirma no diálogo
- **THEN** a exigência, sua conversa e seus arquivos somem dos dois lados, e a auditoria registra a
  exclusão

#### Scenario: Cumprida é imutável

- **WHEN** a exigência está cumprida
- **THEN** o painel não oferece editar nem excluir para ela

#### Scenario: Mais de uma exigência ao mesmo tempo

- **WHEN** o pedido tem uma exigência pendente e outra já cumprida
- **THEN** o detalhe mostra as duas, cada uma com seu próprio estado

## ADDED Requirements

### Requirement: Operador anexa documento do cidadão

O operador SHALL poder anexar um documento do cidadão ao pedido pelo painel — o caso do balcão:
o cidadão chega com o papel em mãos e quem atende digitaliza e anexa. O arquivo SHALL entrar na
lista de documentos do cidadão (mesma origem dos enviados pelo site) e SHALL ficar visível na
consulta de protocolo do cidadão.

#### Scenario: Digitalização anexada no atendimento

- **WHEN** o operador anexa o PDF digitalizado na seção de documentos do cidadão
- **THEN** o arquivo aparece na lista de documentos do cidadão no painel e na consulta com chave

### Requirement: Avisos por e-mail nas ações que afetam o cidadão

Ações do operador que mudam o que o cidadão vê SHALL disparar aviso por e-mail quando o contato
do pedido for um e-mail: exigência registrada, pedido concluído, pedido cancelado e documento de
entrega disponível. O aviso NÃO SHALL carregar o conteúdo (texto da exigência, arquivo) — apenas
o protocolo e a instrução de consultar com a chave. O envio SHALL ser fire-and-forget: falha de
e-mail nunca falha a ação.

#### Scenario: Exigência registrada avisa

- **WHEN** o operador registra uma exigência num pedido cujo contato é e-mail
- **THEN** chega um aviso "há uma exigência no seu pedido", sem o texto da exigência

#### Scenario: Conclusão avisa

- **WHEN** o operador muda o andamento para "Concluído"
- **THEN** chega um aviso de conclusão ao contato

#### Scenario: Entrega avisa

- **WHEN** o operador anexa um documento de entrega
- **THEN** chega um aviso "há um documento disponível no seu pedido", sem o arquivo

#### Scenario: Andamento intermediário não avisa

- **WHEN** o operador muda o andamento para "Prenotado"
- **THEN** nenhum e-mail é enviado — o cidadão acompanha pela consulta; avisar cada passo viraria ruído

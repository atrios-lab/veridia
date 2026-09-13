## ADDED Requirements

### Requirement: Motivo do indeferimento exibido na consulta pública

Quando a consulta pública do protocolo (`/acompanhar`) mostra um pedido com desfecho "Indeferido", ela SHALL exibir a justificativa registrada pelo cartório (`statusReason`) e, quando houver, o link para baixar o documento anexado ao indeferimento, em destaque na página e com espaço para texto longo — separado do card de instruções curtas ("refaça o pedido", canal de atendimento), que SHALL NOT carregar o texto do motivo em si. A consulta SHALL NOT afirmar que o motivo foi enviado ao cidadão por mensagem, e-mail ou qualquer outro canal — nenhum envio desse tipo existe. Quando nem texto nem documento foram registrados, a consulta SHALL informar que o motivo não foi informado, em vez de omitir a seção.

#### Scenario: Motivo em texto aparece em destaque, fora do card de instruções
- **WHEN** o cidadão consulta um pedido com desfecho "Indeferido" e o cartório registrou `statusReason`
- **THEN** a consulta exibe esse texto como o motivo do indeferimento, em uma seção própria com espaço para texto longo, e não dentro do card de instruções curtas

#### Scenario: Documento do indeferimento fica disponível para download
- **WHEN** o cartório anexou um PDF ao indeferir o pedido
- **THEN** a consulta oferece um botão para baixar esse documento junto ao motivo (ou no lugar dele, quando não há texto)

#### Scenario: Nenhum motivo registrado mostra aviso explícito
- **WHEN** o pedido está indeferido e o cartório não registrou nem texto nem documento
- **THEN** a consulta informa que o motivo não foi informado, em vez de omitir a seção de motivo

#### Scenario: Nenhuma mensagem de envio é afirmada
- **WHEN** o cidadão consulta um pedido indeferido ou cancelado
- **THEN** nenhum texto da página afirma que o motivo foi "enviado" ao cidadão por mensagem, e-mail ou qualquer canal externo

### Requirement: Orientação de próximo passo após indeferimento

Quando o desfecho exibido na consulta pública é "Indeferido", a consulta SHALL orientar o cidadão a refazer o pedido de forma adequada ao que motivou o indeferimento, como próximo passo disponível. Esta orientação SHALL NOT aparecer para o desfecho "Cancelado", que não implica um pedido malfeito.

#### Scenario: Indeferido orienta a refazer o pedido corretamente
- **WHEN** o cidadão consulta um pedido com desfecho "Indeferido"
- **THEN** a consulta exibe uma orientação para refazer o pedido de forma adequada à sua solicitação, além do motivo e do canal de atendimento

#### Scenario: Cancelado não recebe a orientação de indeferimento
- **WHEN** o cidadão consulta um pedido com desfecho "Cancelado"
- **THEN** a consulta não exibe a orientação de refazer o pedido, mantendo apenas motivo e canal de atendimento

### Requirement: Apresentação do motivo em largura total, com parágrafos preservados

Quando o desfecho exibido na consulta pública é "Indeferido" ou "Cancelado", a área de instruções curtas (card de alerta) SHALL aparecer antes do motivo, e o motivo SHALL ocupar a largura total do conteúdo da página, não uma coluna estreita ao lado de outro conteúdo. O texto do motivo SHALL ser justificado. Quando o motivo contém linhas em branco separando trechos, a consulta SHALL renderizar cada trecho como um parágrafo visualmente distinto, preservando a formatação que o cartório digitou.

#### Scenario: Alerta aparece antes do motivo
- **WHEN** o cidadão consulta um pedido com desfecho "Indeferido" ou "Cancelado"
- **THEN** o card de instruções curtas aparece antes do bloco de motivo, na ordem de leitura da página

#### Scenario: Motivo ocupa a largura total do conteúdo
- **WHEN** o cidadão consulta um pedido com desfecho "Indeferido" ou "Cancelado"
- **THEN** o bloco de motivo se estende pela largura total da área de conteúdo da página, em vez de dividir espaço com outro bloco ao lado

#### Scenario: Parágrafos separados por linha em branco continuam separados
- **WHEN** o cartório registrou um motivo com dois ou mais trechos separados por uma linha em branco
- **THEN** a consulta exibe cada trecho como um parágrafo distinto, na mesma ordem em que foram digitados

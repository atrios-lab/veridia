## ADDED Requirements

### Requirement: Andamento do pedido de serviço tem oito estados possíveis

O andamento de um pedido de serviço (`kind = "service-request"`) SHALL ser um entre: Novo, Em
análise, Aguardando pagamento, Pago, Concluído, Indeferido, Cancelado, Arquivado. O servidor SHALL
recusar qualquer valor fora desta lista fechada. O pedido SHALL nascer no andamento "Novo".

#### Scenario: Todos os oito estados têm rótulo em português

- **WHEN** o andamento de um pedido de serviço é qualquer um dos oito valores válidos
- **THEN** existe um rótulo em português para ele, sem cair no rótulo genérico "Em andamento"

#### Scenario: Valor fora da lista é recusado

- **WHEN** uma escrita tenta gravar um andamento que não está entre os oito valores
- **THEN** a escrita é recusada e o andamento gravado não muda

### Requirement: Exigência é um dado do pedido de serviço, com ciclo de vida próprio

Um pedido de serviço SHALL poder ter zero ou mais exigências. Cada exigência SHALL nascer com
status "pendente" e texto livre, e SHALL passar a "cumprida" quando o cidadão enviar exatamente um
anexo de resposta pela consulta de protocolo, registrando a data de cumprimento.

#### Scenario: Exigência nasce pendente

- **WHEN** uma exigência é registrada num pedido
- **THEN** ela existe com status "pendente" e sem data de cumprimento

#### Scenario: Exigência é cumprida com um anexo de resposta

- **WHEN** o cidadão envia um anexo para uma exigência pendente
- **THEN** a exigência passa a "cumprida", com a data de cumprimento e o anexo vinculado a ela

#### Scenario: Um pedido pode ter mais de uma exigência

- **WHEN** um pedido já tem uma exigência cumprida e recebe uma nova exigência
- **THEN** as duas exigências existem de forma independente, cada uma com seu próprio status

### Requirement: Cidadão cumpre a exigência pela própria consulta de protocolo, sem contato adicional

A consulta de protocolo (`/protocolo`) SHALL exibir qualquer exigência pendente do pedido
consultado, e SHALL permitir que o cidadão a cumpra enviando um anexo — usando apenas protocolo e
chave de acesso que ele já tem, sem exigir e-mail ou telefone adicional.

#### Scenario: Exigência pendente aparece na consulta

- **WHEN** o cidadão consulta um pedido com exigência pendente, usando protocolo e chave corretos
- **THEN** a exigência aparece com seu texto e o campo para enviar o anexo de resposta

#### Scenario: Cumprir não exige contato adicional

- **WHEN** o cidadão envia o anexo de resposta pela consulta
- **THEN** a exigência é cumprida sem que nenhum e-mail ou telefone seja solicitado além do que a
  consulta já usa

#### Scenario: Exigência cumprida sai da lista de pendências

- **WHEN** a exigência é cumprida
- **THEN** ela deixa de aparecer como pendente na consulta, tanto para o cidadão quanto para o selo
  "exigência aberta" que a fila do painel mostra

### Requirement: Valor do pedido nasce indefinido e não é exibido ao cidadão

Um pedido de serviço SHALL nascer sem valor definido. Enquanto o valor não for informado, nenhuma
tela ou resposta voltada ao cidadão SHALL exibi-lo ou sugerir cobrança.

#### Scenario: Pedido nasce sem valor

- **WHEN** um pedido de serviço é criado, pelo wizard público ou pelo lançamento manual
- **THEN** ele não tem valor definido

#### Scenario: Cidadão não vê o valor nesta mudança

- **WHEN** um pedido tem valor informado pelo operador
- **THEN** a consulta de protocolo do cidadão não exibe esse valor nem qualquer forma de pagamento

### Requirement: Reemissão de chave de acesso invalida a anterior imediatamente

Reemitir a chave de acesso de um pedido SHALL substituir o hash guardado pelo hash da chave nova.
A partir da reemissão, a chave anterior NÃO SHALL mais autenticar nenhuma consulta ou download
daquele pedido.

#### Scenario: Chave antiga para de funcionar

- **WHEN** a chave de um pedido é reemitida e alguém tenta consultar o protocolo com a chave
  anterior
- **THEN** a consulta se comporta como se a chave estivesse errada, sem indicar que existiu uma
  chave anterior válida

#### Scenario: Chave nova não é recuperável depois

- **WHEN** a reemissão é concluída
- **THEN** o texto claro da chave nova não é lido de volta do banco em nenhuma consulta posterior —
  apenas o hash é armazenado, como já vale para a chave original

## ADDED Requirements

### Requirement: Acesso à tela exige a permissão `requests.manage`

Toda rota sob `/admin/pedidos` SHALL exigir sessão válida na serventia do host e a permissão
`requests.manage`, checada no servidor. A permissão SHALL ser concedida aos papéis `admin` e
`staff` — processar pedido é trabalho de operação do dia a dia, não configuração sensível.

#### Scenario: Acesso concedido a ambos os papéis

- **WHEN** um usuário com papel `admin` ou papel `staff` abre `/admin/pedidos`
- **THEN** a fila é exibida normalmente para os dois papéis

#### Scenario: Acesso recusado sem sessão

- **WHEN** uma requisição chega a qualquer rota sob `/admin/pedidos` sem sessão válida
- **THEN** o servidor recusa o acesso, independentemente de item de menu existir ou não

### Requirement: Fila de pedidos filtrável e pesquisável

`/admin/pedidos` SHALL listar os pedidos da serventia da sessão em ordem decrescente de criação,
cada linha mostrando protocolo, solicitante (nome e contato), ato, andamento (com selo colorido),
valor (ou "—" quando não informado) e data. A fila SHALL oferecer filtro por andamento, filtro por
atribuição e busca por texto que casa protocolo ou nome do solicitante. Clicar numa linha SHALL
levar ao detalhe daquele pedido.

#### Scenario: Filtro por andamento

- **WHEN** o operador filtra por "Aguardando pagamento"
- **THEN** só pedidos nesse andamento aparecem na lista

#### Scenario: Busca por protocolo

- **WHEN** o operador busca por `REQ.2026.000482`
- **THEN** só o pedido daquele protocolo aparece

#### Scenario: Busca por nome

- **WHEN** o operador busca por parte do nome do solicitante
- **THEN** os pedidos cujo nome contém o texto buscado aparecem, sem diferenciar maiúsculas de
  minúsculas

#### Scenario: Linha leva ao detalhe

- **WHEN** o operador clica numa linha da fila
- **THEN** a tela de detalhe daquele protocolo abre

### Requirement: Contador de pedidos em aberto

Um pedido SHALL contar como "em aberto" quando seu andamento não for Concluído, Indeferido,
Cancelado nem Arquivado. O contador de pedidos em aberto SHALL aparecer no item "Pedidos de
serviço" da sidebar e SHALL refletir apenas os pedidos da serventia da sessão.

#### Scenario: Contador soma só andamentos não-terminais

- **WHEN** a serventia tem 3 pedidos em "Novo", 1 em "Em análise" e 2 em "Concluído"
- **THEN** o contador mostra 4

#### Scenario: Contador por serventia

- **WHEN** duas serventias têm pedidos em aberto em quantidades diferentes
- **THEN** cada uma vê só o próprio contador

### Requirement: Detalhe do pedido reúne dados do solicitante, anexos e histórico

`/admin/pedidos/[protocolo]` SHALL exibir: dados do solicitante (nome, CPF mascarado, e-mail ou
telefone, finalidade quando o ato exigir), os documentos anexados pelo cidadão na submissão, e um
histórico em ordem cronológica reversa com autor, ação e data de cada evento relevante (criação do
pedido, mudança de andamento, registro e cumprimento de exigência, entrega de documento, reemissão
de chave).

#### Scenario: CPF mascarado

- **WHEN** o detalhe do pedido é aberto
- **THEN** o CPF aparece parcialmente oculto (ex.: `083.***.***-20`), nunca por completo

#### Scenario: Histórico em ordem cronológica reversa

- **WHEN** um pedido teve a exigência registrada antes de o andamento mudar para "Em análise"
- **THEN** o histórico mostra a mudança de andamento acima do registro da exigência

### Requirement: Mudar o andamento a partir do detalhe

O detalhe SHALL mostrar o andamento atual e oferecer, como sugestão, os andamentos alcançáveis a
partir dele (ex.: a partir de "Em análise": Aguardando pagamento, Indeferido, Cancelado). O
operador SHALL poder, além da sugestão, escolher qualquer um dos oito andamentos válidos. O
servidor SHALL aceitar qualquer valor da lista fechada de oito e recusar qualquer outro. Toda
mudança SHALL gravar entrada no histórico do pedido.

#### Scenario: Transição sugerida

- **WHEN** o pedido está em "Em análise"
- **THEN** a tela oferece diretamente Aguardando pagamento, Indeferido e Cancelado como próximo
  andamento

#### Scenario: Correção manual fora da sugestão

- **WHEN** o operador precisa corrigir um pedido de "Cancelado" de volta para "Em análise"
- **THEN** a mudança é aceita, mesmo não sendo uma das sugestões diretas daquele andamento

#### Scenario: Valor inválido é recusado

- **WHEN** uma requisição tenta gravar um andamento fora dos oito valores válidos
- **THEN** o servidor recusa e o andamento do pedido não muda

### Requirement: Registrar exigência a partir do detalhe

O operador SHALL poder registrar uma exigência (texto livre) num pedido. A exigência registrada
SHALL aparecer de imediato na consulta de protocolo do cidadão. Quando o cidadão a cumprir, o
detalhe SHALL mostrar a exigência como cumprida, com a data de cumprimento e o anexo de resposta.

#### Scenario: Exigência aparece assim que registrada

- **WHEN** o operador registra "Falta cópia legível do documento de identidade"
- **THEN** a consulta de protocolo daquele pedido já mostra a exigência pendente, sem precisar de
  outra ação

#### Scenario: Exigência cumprida mostra o anexo de resposta

- **WHEN** o cidadão cumpre a exigência enviando um arquivo pela consulta de protocolo
- **THEN** o detalhe do pedido mostra a exigência como cumprida, com a data e um link para o
  arquivo enviado

#### Scenario: Mais de uma exigência ao mesmo tempo

- **WHEN** o pedido tem uma exigência pendente e outra já cumprida
- **THEN** o detalhe mostra as duas, cada uma com seu próprio estado

### Requirement: Entregar o documento final ao cidadão

O operador SHALL poder anexar o documento final de um pedido. O anexo SHALL ser gravado como um
anexo da serventia, distinto dos anexos enviados pelo cidadão na submissão, e SHALL ficar
disponível na consulta de protocolo do cidadão.

#### Scenario: Documento entregue aparece na consulta do cidadão

- **WHEN** o operador anexa o documento final assinado
- **THEN** a consulta de protocolo do cidadão passa a oferecer aquele arquivo para download

#### Scenario: Anexo da serventia não se mistura com os do cidadão

- **WHEN** o detalhe do pedido lista os anexos
- **THEN** o documento entregue pela serventia aparece separado dos documentos que o cidadão
  enviou na submissão

### Requirement: Informar o valor do pedido

O operador SHALL poder informar o valor do pedido, em reais, quando ele ainda não tiver sido
informado, e SHALL poder corrigi-lo depois de já informado. Um pedido sem valor informado SHALL
mostrar "—" na fila e a mensagem de que o valor ainda não foi informado no detalhe.

#### Scenario: Informar valor pela primeira vez

- **WHEN** o operador informa R$ 62,10 num pedido sem valor
- **THEN** o pedido passa a mostrar R$ 62,10 na fila e no detalhe

#### Scenario: Corrigir valor já informado

- **WHEN** o operador altera um valor já informado
- **THEN** o novo valor substitui o anterior e a mudança fica registrada no histórico

### Requirement: Emitir nova chave de acesso

O detalhe SHALL oferecer "Emitir nova chave", com confirmação explícita antes de executar. A nova
chave SHALL aparecer em texto claro uma única vez, na resposta da própria ação, e nunca mais
depois disso — mesmo relendo a tela.

#### Scenario: Emissão pede confirmação

- **WHEN** o operador aciona "Emitir nova chave"
- **THEN** o sistema pede confirmação antes de gerar a chave nova

#### Scenario: Chave nova some depois de mostrada

- **WHEN** a chave nova é exibida após a confirmação
- **THEN** recarregar a tela do detalhe não mostra a chave em claro de novo

### Requirement: Excluir protocolo é exceção, não fim de fluxo

"Excluir protocolo" SHALL exigir confirmação explícita e SHALL declarar, na própria tela, que a
ação é reservada a abertura por engano (protocolo duplicado, teste) e que um pedido real que não
deve seguir usa o andamento "Cancelado". A exclusão SHALL registrar entrada em `audit_log` com
protocolo, solicitante e ato antes de apagar a linha.

#### Scenario: Exclusão pede confirmação

- **WHEN** o operador aciona "Excluir protocolo"
- **THEN** o sistema pede confirmação explícita antes de excluir

#### Scenario: Auditoria sobrevive à exclusão

- **WHEN** um pedido é excluído
- **THEN** existe uma entrada em `audit_log` identificando o protocolo excluído, mesmo que o
  pedido em si não exista mais no banco

### Requirement: Lançar pedido manualmente para atendimento presencial

`/admin/pedidos/novo` SHALL usar o mesmo vocabulário atribuição → ato do wizard público
(`/solicitar`) e o mesmo schema de validação (`serviceRequestSchema`), num formulário único. O
pedido lançado SHALL gerar protocolo e chave de acesso como no site público, e SHALL ficar marcado
como recebido presencialmente.

#### Scenario: Pedido lançado gera protocolo e chave

- **WHEN** o operador preenche e envia o formulário de lançamento manual
- **THEN** o pedido é criado com protocolo `REQ.AAAA.NNNNNN` e chave de acesso, mostrados na
  própria tela

#### Scenario: Pedido lançado aparece na fila marcado como presencial

- **WHEN** o operador abre a fila depois de lançar um pedido manualmente
- **THEN** o pedido aparece na lista e seu histórico mostra que foi lançado no balcão pela pessoa
  que o lançou

#### Scenario: Validação segue a mesma regra do ato

- **WHEN** o ato escolhido exige finalidade e o operador não a preenche
- **THEN** o formulário recusa o envio com o mesmo erro que o wizard público mostraria

# admin-service-requests Specification

## Purpose
A fila e o detalhe do pedido de serviço no painel: o que o balcão vê, muda e entrega desde que o protocolo nasce até a conclusão. Inclui a paridade de balcão trazida do painel legado — imprimir a folha, corrigir os dados protocolados e anexar à exigência o formulário que o cidadão apresenta.
## Requirements
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

O selo colorido do andamento SHALL ter a mesma cor na fila e no detalhe, e a cor SHALL ser
decidida pelo que o andamento pede do balcão, em cinco tons:

- **bloqueado** (vermelho): Com exigência, Aguardando exigência, Indeferido
- **esperando** (laranja): Novo, Protocolado, Aguardando pagamento
- **em curso** (verde): Em análise, Pago, Prenotado, Em qualificação, Em processamento,
  Registrado, Averbado, Deferido
- **entregue** (tinta do escritório): Disponível para retirada, Concluído
- **encerrado** (cinza): Cancelado, Arquivado

Cada um dos dezoito andamentos SHALL ter exatamente um tom declarado; nenhum andamento SHALL
receber cor por omissão.

#### Scenario: Exigência se destaca na fila

- **WHEN** a fila mostra um pedido em "Com exigência" ao lado de um em "Em análise"
- **THEN** o selo da exigência sai no tom bloqueado (vermelho) e o de "Em análise" no tom em curso
  (verde), com destaque equivalente ao laranja de "Aguardando pagamento"

#### Scenario: Fila e detalhe combinam

- **WHEN** o operador abre o detalhe de um pedido que viu na fila
- **THEN** o selo do andamento tem a mesma cor nas duas telas

#### Scenario: Andamento novo exige tom

- **WHEN** um décimo nono andamento é acrescentado à lista sem tom declarado
- **THEN** a build falha, em vez de o andamento aparecer com uma cor herdada em silêncio

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
excluída pelo operador: a exclusão remove a exigência, sua conversa e seus arquivos, atrás da
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

### Requirement: Recibo por e-mail do pedido lançado no balcão

Quando o pedido é lançado manualmente e o contato registrado é um e-mail, o cidadão SHALL
receber um recibo com o número do protocolo e a instrução de guardar o protocolo e a chave
entregues no atendimento; a chave MUST NOT constar do e-mail. O envio SHALL ser
fire-and-forget: falha de e-mail nunca falha o lançamento.

#### Scenario: Recibo enviado

- **WHEN** o operador lança um pedido com contato "joao@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o protocolo e sem a chave

#### Scenario: Contato é telefone

- **WHEN** o operador lança um pedido com contato "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o pedido é lançado normalmente

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo.
Enquanto uma chave recém-emitida estiver visível na tela, o painel DEVE (SHALL) oferecer também
o comprovante de acesso para impressão; fora desse momento, NÃO DEVE (SHALL NOT) existir caminho
no painel que produza a chave em claro.

#### Scenario: Folha para assinar no balcão
- **WHEN** o operador aciona a impressão num pedido sem requerimento assinado
- **THEN** recebe o requerimento em PDF do pedido, sem chave de acesso em página nenhuma

#### Scenario: Via assinada quando ela existe
- **WHEN** o pedido tem um requerimento assinado devolvido pelo cidadão
- **THEN** a ação de imprimir abre o arquivo assinado, que é o papel que o balcão arquiva

#### Scenario: Comprovante só enquanto a chave está na tela
- **WHEN** o operador acabou de emitir uma nova chave e ela está visível
- **THEN** pode imprimir o comprovante de acesso com essa chave; ao sair da tela, o caminho desaparece

#### Scenario: Rota autenticada por sessão
- **WHEN** a rota de impressão é chamada sem sessão com `requests.manage`
- **THEN** a resposta nega o acesso, sem gerar documento

### Requirement: Corrigir os dados protocolados
O detalhe do pedido DEVE (SHALL) permitir corrigir nome, contato, CPF, finalidade, descrição e a
data/hora do atendimento — o balcão lança o atendimento depois, e o protocolo vale pelo momento
do atendimento. Cada correção DEVE (SHALL) entrar no histórico do pedido. O ato e o número de
protocolo NÃO DEVEM (SHALL NOT) ser editáveis: trocar o ato muda a atribuição e a base legal do
que já foi protocolado.

#### Scenario: Erro de digitação corrigido sem refazer o pedido
- **WHEN** o operador corrige o nome do solicitante e salva
- **THEN** o detalhe e a consulta do cidadão passam a mostrar o nome corrigido, e o histórico registra quem corrigiu e quando

#### Scenario: Data e hora do atendimento
- **WHEN** o operador ajusta a data/hora de um pedido lançado depois do atendimento presencial
- **THEN** o pedido passa a valer pelo momento informado, refletido no detalhe e na consulta

#### Scenario: O ato não se edita
- **WHEN** o formulário de edição é aberto
- **THEN** não há campo para trocar o ato nem o protocolo

#### Scenario: Só com permissão
- **WHEN** a ação de salvar é chamada sem sessão com `requests.manage`
- **THEN** nada é alterado e a resposta nega a permissão

### Requirement: Formulário anexado à exigência
A serventia DEVE (SHALL) poder anexar a uma exigência o formulário que o cidadão precisa
imprimir e apresentar. O arquivo pertence à exigência: DEVE (SHALL) aparecer no cartão dela — no
painel e na consulta do cidadão — e NÃO DEVE (SHALL NOT) entrar na lista "Documentos da
serventia" nem no prazo de disponibilidade dessa lista. Excluir a exigência ou o pedido leva o
formulário junto.

#### Scenario: Serventia anexa o modelo
- **WHEN** o operador anexa um formulário a uma exigência pendente
- **THEN** o arquivo aparece no cartão da exigência com nome legível e pode ser aberto dali

#### Scenario: Cidadão baixa pelo cartão da exigência
- **WHEN** o cidadão abre a consulta com protocolo e chave e a exigência tem formulário
- **THEN** o cartão da exigência oferece o download, protegido pela mesma chave dos demais documentos

#### Scenario: Fora da lista de entregas
- **WHEN** um formulário está anexado a uma exigência
- **THEN** ele não aparece em "Entrega ao cidadão" no painel nem em "Documentos da serventia" na consulta

### Requirement: Operador anexa documento do cidadão
O operador SHALL poder anexar um documento do cidadão ao pedido pelo painel, o caso do balcão:
o cidadão chega com o papel em mãos e quem atende digitaliza e anexa. O arquivo SHALL entrar na
lista de documentos do cidadão (mesma origem dos enviados pelo site) e SHALL ficar visível na
consulta de protocolo do cidadão.

#### Scenario: Digitalização anexada no atendimento
- **WHEN** o operador anexa o PDF digitalizado na seção de documentos do cidadão
- **THEN** o arquivo aparece na lista de documentos do cidadão no painel e na consulta com chave

### Requirement: Avisos por e-mail nas ações que afetam o cidadão
Ações do operador que mudam o que o cidadão vê SHALL disparar aviso por e-mail quando o contato
do pedido for um e-mail: exigência registrada, pedido concluído, pedido cancelado, documento de
entrega disponível, valor do pedido informado pela primeira vez e formulário anexado a uma
exigência. O aviso NÃO SHALL carregar o conteúdo (texto da exigência, arquivo, valor): apenas
o protocolo e a instrução de consultar com a chave. O envio SHALL ser fire-and-forget: falha de e-mail nunca falha a ação.

#### Scenario: Exigência registrada avisa
- **WHEN** o operador registra uma exigência num pedido cujo contato é e-mail
- **THEN** chega um aviso "há uma exigência no seu pedido", sem o texto da exigência

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

### Requirement: Controle de prazo na troca de andamento
O formulário de troca de andamento no detalhe do pedido SHALL exibir o prazo vigente (data prevista e dia da contagem) e oferecer, opcionalmente, três escolhas: manter o prazo (padrão, sem interação extra), zerar o prazo (a contagem recomeça na data de hoje com os mesmos dias) ou ajustar a quantidade de dias. A escolha SHALL ser gravada na mesma operação que troca o andamento, e a alteração de prazo SHALL constar na auditoria. O controle SHALL estar disponível também nos pedidos lançados no balcão. O servidor SHALL validar que os dias estão entre 1 e 365.

#### Scenario: Trocar andamento mantendo o prazo
- **WHEN** o operador troca o andamento sem tocar no controle de prazo
- **THEN** o andamento muda e o prazo do pedido permanece como estava

#### Scenario: Zerar o prazo ao iniciar a análise
- **WHEN** o operador troca o andamento e escolhe zerar o prazo
- **THEN** a contagem do pedido passa a iniciar na data de hoje, com a mesma quantidade de dias vigente

#### Scenario: Conceder prazo maior
- **WHEN** o operador troca o andamento e ajusta a quantidade de dias para um valor maior
- **THEN** o pedido passa a contar com a nova quantidade de dias a partir do início vigente

#### Scenario: Alteração de prazo auditada
- **WHEN** o operador zera ou ajusta o prazo de um pedido
- **THEN** o registro de auditoria da ação inclui a alteração de prazo

### Requirement: Urgência do prazo na fila e no detalhe do pedido
A fila de pedidos e o cabeçalho do detalhe SHALL exibir um badge de urgência derivado do prazo vigente, contado em dias úteis: "vence em N dias" quando faltam 3 dias úteis ou menos, e "vencido há N dias" quando a data prevista passou. Pedidos em andamento terminal SHALL NOT exibir urgência. Fora da janela de urgência, nenhum badge de prazo é exibido.

#### Scenario: Pedido perto do vencimento
- **WHEN** o operador abre a fila e um pedido em andamento está a 3 dias ou menos da data prevista
- **THEN** a linha exibe o badge indicando em quantos dias o prazo vence

#### Scenario: Pedido vencido
- **WHEN** um pedido em andamento passou da data prevista
- **THEN** a fila e o detalhe exibem o badge com há quantos dias o prazo venceu

#### Scenario: Pedido encerrado não tem urgência
- **WHEN** um pedido está em andamento terminal, mesmo com a data prevista no passado
- **THEN** nenhum badge de urgência de prazo é exibido

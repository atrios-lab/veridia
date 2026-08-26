## MODIFIED Requirements

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo.
Enquanto uma chave recém-emitida estiver visível na tela, o painel DEVE (SHALL) oferecer também
o comprovante de acesso para impressão; fora desse momento, NÃO DEVE (SHALL NOT) existir caminho
no painel que produza a chave em claro.

A oferta DEVE (SHALL) existir na interface, não apenas na rota: uma rota que produz o documento
sem tela que a acione não cumpre este requisito.

Toda emissão de qualquer um dos dois documentos DEVE (SHALL) registrar entrada em `audit_log`
identificando quem emitiu, qual documento e qual protocolo. O comprovante entrega a chave de
acesso do cidadão em claro a quem imprime, e uma reimpressão sem rastro não permite responder
depois quem teve acesso a ela.

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

#### Scenario: A tela do detalhe oferece a impressão
- **WHEN** o operador abre o detalhe de um pedido de serviço
- **THEN** encontra ali a ação de imprimir o requerimento, sem precisar montar a URL à mão

#### Scenario: Impressão do requerimento fica na auditoria
- **WHEN** o operador imprime o requerimento de um pedido
- **THEN** existe entrada em `audit_log` com quem imprimiu, o protocolo e a data

#### Scenario: Impressão do comprovante fica na auditoria
- **WHEN** o operador imprime o comprovante de acesso de um pedido
- **THEN** existe entrada em `audit_log` distinguindo-a da impressão do requerimento, com quem
  imprimiu, o protocolo e a data

#### Scenario: Emissão recusada não vira registro
- **WHEN** a rota de impressão recusa o pedido por falta de sessão, permissão ou chave correta
- **THEN** nenhuma entrada de emissão é gravada, porque documento nenhum foi produzido

### Requirement: Lançar pedido manualmente para atendimento presencial

`/admin/pedidos/novo` SHALL usar o mesmo vocabulário atribuição → ato do wizard público
(`/solicitar`) e o mesmo schema de validação (`serviceRequestSchema`), num formulário único. O
pedido lançado SHALL gerar protocolo e chave de acesso como no site público, e SHALL ficar marcado
como recebido presencialmente.

A tela de sucesso SHALL identificar o pedido que acabou de nascer, nomeando ao menos o requerente
e o ato, além do protocolo e da chave: dois códigos sozinhos não deixam o operador conferir que
lançou o pedido certo.

A tela de sucesso SHALL oferecer a impressão do requerimento e a do comprovante de acesso,
individualmente e as duas de uma vez, pelos mesmos caminhos e com as mesmas regras do requisito
"Imprimir o requerimento no balcão" — inclusive o registro em auditoria. A chave em claro está
visível nesta tela e só nela, o que é exatamente a condição que aquele requisito exige para o
comprovante. A tela SHALL oferecer também copiar protocolo e chave juntos, para o caso em que o
cidadão prefere receber por outro meio que não o papel.

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

#### Scenario: A tela de sucesso diz de quem é o pedido

- **WHEN** o operador termina o lançamento
- **THEN** a tela nomeia o requerente e o ato lançados, junto do protocolo e da chave

#### Scenario: Imprimir os dois documentos ao fim do lançamento

- **WHEN** o operador aciona a impressão dos dois na tela de sucesso
- **THEN** recebe o requerimento e o comprovante de acesso, este último com a chave que está na
  tela, e ambas as emissões ficam na auditoria

#### Scenario: Sair da tela fecha o caminho do comprovante

- **WHEN** o operador deixa a tela de sucesso e volta ao pedido pela fila
- **THEN** não há caminho que reimprima o comprovante daquele lançamento sem emitir uma chave
  nova, porque a chave em claro não existe mais em lugar nenhum

### Requirement: Emitir nova chave de acesso

O detalhe SHALL oferecer "Emitir nova chave", com confirmação explícita antes de executar. A nova
chave SHALL aparecer em texto claro uma única vez, na resposta da própria ação, e nunca mais
depois disso — mesmo relendo a tela.

Enquanto essa chave estiver visível, a mesma seção SHALL oferecer a impressão do comprovante de
acesso com ela, conforme o requisito "Imprimir o requerimento no balcão". É o único momento em
que o comprovante pode ser produzido para um pedido já existente, porque o banco guarda a chave
apenas como hash.

#### Scenario: Emissão pede confirmação

- **WHEN** o operador aciona "Emitir nova chave"
- **THEN** o sistema pede confirmação antes de gerar a chave nova

#### Scenario: Chave nova some depois de mostrada

- **WHEN** a chave nova é exibida após a confirmação
- **THEN** recarregar a tela do detalhe não mostra a chave em claro de novo

#### Scenario: Comprovante impresso a partir da chave recém-emitida

- **WHEN** a chave nova está visível na seção de chave de acesso
- **THEN** o operador pode imprimir dali o comprovante com essa chave, e a emissão fica na
  auditoria

#### Scenario: Chave antiga não imprime comprovante

- **WHEN** a tela é recarregada e a chave já não está em claro
- **THEN** a seção não oferece mais a impressão do comprovante

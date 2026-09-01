## MODIFIED Requirements

### Requirement: Solicitação de gratuidade (ISENTO) nos atos que a lei isenta
A gratuidade DEVE (SHALL) ser pedida por uma entrada própria na lista de atos, e não por uma opção
dentro do formulário de outro ato. A tela "Escolha o ato" do Registro Civil DEVE (SHALL) exibir
"Solicitar gratuidade (isento)" ao lado dos demais atos da atribuição, com o mesmo selo de
tramitação que os outros exibem. A entrada SÓ DEVE (SHALL) aparecer em atribuição que tenha ao
menos um ato com previsão legal de isenção no catálogo.

Escolhida a entrada, o formulário DEVE (SHALL) perguntar **qual ato** o cidadão quer isento,
oferecendo apenas os atos daquela atribuição que a lei isenta para beneficiário de programa
social: a certidão de RCPN (CF art. 5º, LXXVI; Lei 6.015 art. 30 §1º) e a habilitação de casamento
(CC art. 1.512, parágrafo único). A base legal exibida DEVE (SHALL) ser a do ato escolhido. Uma
submissão sem ato-alvo, ou com um ato-alvo sem previsão de isenção, DEVE (SHALL) ser recusada no
servidor.

O pedido de gratuidade SÓ DEVE (SHALL) ser aceito com:

- a **declaração específica** marcada: o requerente declara ser beneficiário de programa social
  (CadÚnico/CRAS), autoriza a conferência nos sistemas governamentais de benefício social e
  declara ciência de que informação falsa responde criminalmente (Código Penal art. 299) e
  civilmente (Código Civil arts. 186 e 927), com a lei e o artigo visíveis no próprio texto;
- **pelo menos um anexo**, a documentação que comprova o benefício. O formulário DEVE (SHALL)
  listar quais documentos servem, em vez de pedir "a documentação" sem dizer qual, e a lista DEVE
  (SHALL) se apresentar como exemplos, com uma entrada aberta: são muitos programas sociais, e
  uma lista lida como exaustiva afasta quem tem direito mas não se vê nela.

A declaração DEVE (SHALL) ser persistida no registro do pedido com a data em que foi feita e com o
ato que a isenção pede, como os aceites de LGPD e veracidade já são: a prova é do controlador. A
gratuidade solicitada e o ato pedido DEVEM (SHALL) ficar visíveis ao operador na tela do pedido e
constar do requerimento impresso que o cidadão assina. Solicitar NÃO DEVE (SHALL NOT) zerar o
valor do pedido: conceder é decisão da serventia, depois de conferir.

Os formulários dos atos isentáveis NÃO DEVEM (SHALL NOT) mais oferecer a opção de gratuidade: o
caminho é um só. Pedidos protocolados antes desta mudança, sem ato-alvo gravado, DEVEM (SHALL)
continuar legíveis no painel e no requerimento, sem ato inventado no lugar do que falta.

#### Scenario: A gratuidade aparece na lista de atos do Registro Civil
- **WHEN** o cidadão escolhe a atribuição Registro Civil e vê a tela "Escolha o ato"
- **THEN** "Solicitar gratuidade (isento)" aparece entre os atos, com selo de tramitação

#### Scenario: A entrada não aparece onde nenhum ato é isentável
- **WHEN** o cidadão abre a lista de atos de uma atribuição sem ato com previsão de isenção
- **THEN** a entrada da gratuidade não é oferecida

#### Scenario: O cidadão diz qual ato quer isento
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** o formulário oferece a certidão de RCPN e a habilitação de casamento, e mostra a base
  legal do ato que ele escolher

#### Scenario: Gratuidade sem ato-alvo é recusada
- **WHEN** o cidadão envia o pedido de gratuidade sem escolher o ato
- **THEN** o pedido não é protocolado e o erro aponta a escolha do ato

#### Scenario: Ato-alvo sem previsão de isenção é recusado no servidor
- **WHEN** uma submissão chega ao servidor com um ato-alvo que não tem previsão legal de isenção
- **THEN** o servidor recusa, ainda que o cliente tenha sido contornado

#### Scenario: Gratuidade sem a declaração é recusada
- **WHEN** o cidadão preenche o pedido de gratuidade e envia sem marcar a declaração específica
- **THEN** o pedido não é protocolado e o erro aponta a declaração

#### Scenario: O cidadão lê o que precisa anexar antes de anexar
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** a tela lista os documentos que comprovam o benefício, diz que um deles basta e deixa
  claro que são exemplos, com uma entrada aberta para outros programas sociais

#### Scenario: Gratuidade sem documentação é recusada
- **WHEN** o cidadão envia o pedido de gratuidade sem nenhum anexo
- **THEN** o pedido não é protocolado e o erro diz que a documentação do benefício precisa ser
  anexada

#### Scenario: A declaração vira registro datado, com o ato pedido
- **WHEN** um pedido de gratuidade é protocolado
- **THEN** o registro carrega a declaração com a data em que foi feita e o ato que a isenção pede

#### Scenario: O operador vê, e o papel assina
- **WHEN** o operador abre um pedido de gratuidade
- **THEN** a tela mostra a solicitação e o ato pedido, e o requerimento impresso carrega a
  declaração para o cidadão assinar

#### Scenario: O formulário da certidão não pede mais gratuidade
- **WHEN** o cidadão abre o formulário da certidão de RCPN
- **THEN** nenhuma opção de gratuidade aparece ali, e o pedido segue sem declaração nem anexo
  obrigatório

#### Scenario: Pedido antigo continua legível
- **WHEN** o operador abre um pedido de gratuidade protocolado antes desta mudança
- **THEN** a solicitação e a data aparecem como sempre, sem ato pedido e sem erro

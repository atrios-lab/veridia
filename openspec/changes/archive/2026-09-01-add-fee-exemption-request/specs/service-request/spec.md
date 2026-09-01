## ADDED Requirements

### Requirement: Solicitação de gratuidade (ISENTO) nos atos que a lei isenta
O formulário público DEVE (SHALL) oferecer a opção "Solicitar gratuidade (ISENTO)" nos atos que a
lei isenta para beneficiários de programa social: a certidão de RCPN (CF art. 5º, LXXVI; Lei
6.015 art. 30 §1º) e a habilitação de casamento (CC art. 1.512, parágrafo único). Atos sem
previsão de isenção NÃO SHALL exibir a opção, e uma submissão que a marque num ato não isentável
SHALL ser recusada no servidor.

Com a opção marcada, o pedido SÓ SHALL ser aceito com:

- a **declaração específica** marcada: o requerente declara ser beneficiário de programa social
  (CadÚnico/CRAS), autoriza a conferência nos sistemas governamentais de benefício social e
  declara ciência de que informação falsa responde criminalmente (Código Penal art. 299) e
  civilmente (Código Civil arts. 186 e 927), com a lei e o artigo visíveis no próprio texto;
- **pelo menos um anexo**, a documentação que comprova o benefício. O formulário DEVE (SHALL)
  listar quais documentos servem, em vez de pedir "a documentação" sem dizer qual, e a lista DEVE
  (SHALL) se apresentar como exemplos, com uma entrada aberta: são muitos programas sociais, e
  uma lista lida como exaustiva afasta quem tem direito mas não se vê nela.

A declaração DEVE (SHALL) ser persistida no registro do pedido com a data em que foi feita, como
os aceites de LGPD e veracidade já são: a prova é do controlador. A gratuidade solicitada DEVE
(SHALL) ficar visível ao operador na tela do pedido e constar do requerimento impresso que o
cidadão assina. Solicitar NÃO SHALL zerar o valor do pedido: conceder é decisão da serventia,
depois de conferir.

#### Scenario: A opção só aparece nos atos isentáveis
- **WHEN** o cidadão abre o formulário da certidão de RCPN e o da notificação extrajudicial
- **THEN** a opção de gratuidade aparece na certidão e não aparece na notificação

#### Scenario: Gratuidade sem a declaração é recusada
- **WHEN** o cidadão marca "Solicitar gratuidade" e envia sem marcar a declaração específica
- **THEN** o pedido não é protocolado e o erro aponta a declaração

#### Scenario: O cidadão lê o que precisa anexar antes de anexar
- **WHEN** o cidadão marca "Solicitar gratuidade"
- **THEN** a tela lista os documentos que comprovam o benefício, diz que um deles basta e deixa
  claro que são exemplos, com uma entrada aberta para outros programas sociais

#### Scenario: Gratuidade sem documentação é recusada
- **WHEN** o cidadão marca "Solicitar gratuidade" e envia sem nenhum anexo
- **THEN** o pedido não é protocolado e o erro diz que a documentação do benefício precisa ser
  anexada

#### Scenario: A declaração vira registro datado
- **WHEN** um pedido com gratuidade é protocolado
- **THEN** o registro do pedido carrega a declaração com a data em que foi feita, consultável
  depois

#### Scenario: O operador vê, e o papel assina
- **WHEN** o operador abre um pedido com gratuidade solicitada
- **THEN** a tela do pedido mostra a solicitação, e o requerimento impresso carrega a declaração
  para o cidadão assinar

#### Scenario: Ato não isentável não aceita a marcação por fora
- **WHEN** uma submissão chega ao servidor marcando gratuidade num ato sem previsão de isenção
- **THEN** o servidor recusa, ainda que o cliente tenha sido contornado

#### Scenario: Pedido sem gratuidade segue exatamente como era
- **WHEN** o cidadão envia o pedido de um ato isentável sem marcar a opção
- **THEN** nada muda: anexos continuam opcionais e nenhuma declaração extra é exigida

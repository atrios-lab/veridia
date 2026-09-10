## MODIFIED Requirements

### Requirement: Solicitação de gratuidade (ISENTO) nos atos que a lei isenta
A gratuidade DEVE (SHALL) ser pedida por uma entrada própria na lista de atos, e não por uma opção
dentro do formulário de outro ato. A tela "Escolha o ato" do Registro Civil DEVE (SHALL) exibir
"Solicitar gratuidade (isento)" ao lado dos demais atos da atribuição, com o mesmo selo de
tramitação que os outros exibem. A entrada SÓ DEVE (SHALL) aparecer em atribuição que tenha ao
menos um ato com previsão legal de isenção condicionada à hipossuficiência no catálogo.

Certidão de nascimento e certidão de óbito (1ª via) NÃO DEVEM (SHALL NOT) ser oferecidas como
ato-alvo da gratuidade: são gratuitas por lei para qualquer pessoa, independente de renda (Lei
6.015 art. 30 §1º, red. Lei 9.534/97; Provimento CGJ/TJRN n. 7/2026, art. 3º §1º, I e II), e pedi-las
não passa pelo fluxo de gratuidade nem por declaração nenhuma.

Escolhida a entrada, o formulário DEVE (SHALL) perguntar **qual ato** o cidadão quer isento,
oferecendo apenas os atos daquela atribuição com previsão legal de isenção condicionada à
hipossuficiência: a certidão de casamento e demais certidões do RCPN fora nascimento/óbito (CF
art. 5º, LXXVI) e a habilitação de casamento (CC art. 1.512, parágrafo único). A base legal exibida
DEVE (SHALL) ser a do ato escolhido. Uma submissão sem ato-alvo, ou com um ato-alvo sem previsão de
isenção condicionada à hipossuficiência, DEVE (SHALL) ser recusada no servidor.

O pedido de gratuidade SÓ DEVE (SHALL) ser aceito com a **declaração específica** marcada: o
requerente declara ser beneficiário de programa social (CadÚnico/CRAS), autoriza a conferência nos
sistemas governamentais de benefício social e declara ciência de que informação falsa responde
criminalmente (Código Penal art. 299) e civilmente (Código Civil arts. 186 e 927), com a lei e o
artigo visíveis no próprio texto. A declaração marcada, sozinha, É (IS) suficiente para o
protocolo do pedido (Provimento CGJ/TJRN n. 7/2026, art. 5º): o anexo de documentação do benefício
NÃO DEVE (SHALL NOT) ser exigido como condição para protocolar. Quando o cidadão tiver o
comprovante, o formulário DEVE (SHALL) continuar oferecendo o anexo como opcional, listando quais
documentos servem, em vez de pedir "a documentação" sem dizer qual; a lista DEVE (SHALL) se
apresentar como exemplos, com uma entrada aberta, e o texto DEVE (SHALL) deixar claro que anexar é
opcional.

O formulário DEVE (SHALL) perguntar quem formaliza a declaração: a própria pessoa beneficiária
(padrão), um representante legal, ou assinatura a rogo (quando a pessoa beneficiária não sabe ou
não pode assinar). Escolhida uma das duas últimas opções, o formulário DEVE (SHALL) pedir o nome de
quem assina. A declaração DEVE (SHALL) sempre se referir à situação econômica da pessoa
beneficiária, ainda que formalizada por representante ou por rogo (Provimento CGJ/TJRN n. 7/2026,
art. 4º).

A declaração DEVE (SHALL) ser persistida no registro do pedido com a data em que foi feita, o ato
que a isenção pede, e — quando aplicável — quem assinou em nome do beneficiário e a que título
(representante legal ou a rogo), como os aceites de LGPD e veracidade já são: a prova é do
controlador. A gratuidade solicitada e o ato pedido DEVEM (SHALL) ficar visíveis ao operador na
tela do pedido e constar do requerimento impresso que o cidadão assina, com o beneficiário e quem
assina identificados separadamente quando forem pessoas diferentes. Quando a declaração for a
rogo, o requerimento impresso DEVE (SHALL) trazer, em branco para preenchimento no balcão, duas
linhas de assinatura de testemunha e a nota de que o conteúdo foi lido em voz alta e explicado ao
beneficiário. Solicitar NÃO DEVE (SHALL NOT) zerar o valor do pedido: conceder é decisão da
serventia, depois de conferir.

Os formulários dos atos isentáveis NÃO DEVEM (SHALL NOT) mais oferecer a opção de gratuidade: o
caminho é um só. Pedidos protocolados antes desta mudança, sem ato-alvo gravado, sem anexo, ou sem
informação de quem assinou, DEVEM (SHALL) continuar legíveis no painel e no requerimento, sem dado
inventado no lugar do que falta.

#### Scenario: A gratuidade aparece na lista de atos do Registro Civil
- **WHEN** o cidadão escolhe a atribuição Registro Civil e vê a tela "Escolha o ato"
- **THEN** "Solicitar gratuidade (isento)" aparece entre os atos, com selo de tramitação

#### Scenario: A entrada não aparece onde nenhum ato é isentável por hipossuficiência
- **WHEN** o cidadão abre a lista de atos de uma atribuição sem ato com previsão de isenção
  condicionada à hipossuficiência
- **THEN** a entrada da gratuidade não é oferecida

#### Scenario: Certidão de nascimento ou óbito não aparece como ato-alvo da gratuidade
- **WHEN** o cidadão abre o pedido de gratuidade do Registro Civil
- **THEN** a certidão de nascimento e a certidão de óbito não aparecem entre os atos oferecidos

#### Scenario: O cidadão diz qual ato quer isento
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** o formulário oferece a certidão de casamento/demais certidões do RCPN e a habilitação
  de casamento, e mostra a base legal do ato que ele escolher

#### Scenario: Gratuidade sem ato-alvo é recusada
- **WHEN** o cidadão envia o pedido de gratuidade sem escolher o ato
- **THEN** o pedido não é protocolado e o erro aponta a escolha do ato

#### Scenario: Ato-alvo sem previsão de isenção é recusado no servidor
- **WHEN** uma submissão chega ao servidor com um ato-alvo que não tem previsão legal de isenção
  condicionada à hipossuficiência (inclusive nascimento e óbito, contornando o cliente)
- **THEN** o servidor recusa, ainda que o cliente tenha sido contornado

#### Scenario: Gratuidade sem a declaração é recusada
- **WHEN** o cidadão preenche o pedido de gratuidade e envia sem marcar a declaração específica
- **THEN** o pedido não é protocolado e o erro aponta a declaração

#### Scenario: A declaração sozinha basta, sem anexo
- **WHEN** o cidadão marca a declaração de hipossuficiência e envia o pedido sem nenhum anexo
- **THEN** o pedido é protocolado normalmente, sem erro sobre documentação

#### Scenario: O cidadão lê o que pode anexar, sabendo que é opcional
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** a tela lista os documentos que comprovam o benefício, diz que anexar é opcional e que
  um deles basta quando houver, com uma entrada aberta para outros programas sociais

#### Scenario: O cidadão indica que assina por representante legal
- **WHEN** o cidadão escolhe "representante legal" como quem assina a declaração e informa o nome
- **THEN** o pedido é protocolado com o nome do representante gravado à parte do nome do
  beneficiário

#### Scenario: O cidadão indica assinatura a rogo
- **WHEN** o cidadão escolhe "assinatura a rogo" e informa o nome de quem assina
- **THEN** o requerimento impresso traz duas linhas de testemunha em branco e a nota de leitura em
  voz alta ao beneficiário

#### Scenario: A declaração vira registro datado, com o ato pedido e quem assinou
- **WHEN** um pedido de gratuidade é protocolado
- **THEN** o registro carrega a declaração com a data em que foi feita, o ato que a isenção pede, e
  quem assinou quando for diferente do beneficiário

#### Scenario: O operador vê, e o papel assina
- **WHEN** o operador abre um pedido de gratuidade
- **THEN** a tela mostra a solicitação e o ato pedido, e o requerimento impresso carrega a
  declaração para o cidadão (ou quem assina em seu nome) assinar

#### Scenario: O formulário da certidão não pede mais gratuidade
- **WHEN** o cidadão abre o formulário de qualquer certidão do RCPN
- **THEN** nenhuma opção de gratuidade aparece ali, e o pedido segue sem declaração nem anexo

#### Scenario: Pedido antigo continua legível
- **WHEN** o operador abre um pedido de gratuidade protocolado antes desta mudança
- **THEN** a solicitação e a data aparecem como sempre, sem ato pedido, sem anexo e sem quem
  assinou, e sem erro

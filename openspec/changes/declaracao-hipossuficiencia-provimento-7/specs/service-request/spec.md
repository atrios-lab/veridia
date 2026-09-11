## MODIFIED Requirements

### Requirement: Solicitação de gratuidade (ISENTO) nos atos que a lei isenta
A gratuidade DEVE (SHALL) ser pedida por uma entrada própria na lista de atos, e não por uma opção
dentro do formulário de outro ato. A tela "Escolha o ato" do Registro Civil DEVE (SHALL) exibir
"Solicitar gratuidade (isento)" ao lado dos demais atos da atribuição, com o mesmo selo de
tramitação que os outros exibem. A entrada SÓ DEVE (SHALL) aparecer em atribuição que tenha ao
menos um ato com previsão legal de isenção no catálogo.

Escolhida a entrada, o formulário DEVE (SHALL) perguntar **qual ato** o cidadão quer isento,
oferecendo apenas os atos daquela atribuição que a lei isenta mediante declaração de
hipossuficiência: a certidão do RCPN (Lei 6.015 art. 30 §1º e §2º), a habilitação de casamento
(CC art. 1.512, parágrafo único) e a alteração de prenome (Lei 6.015 art. 30 §1º; Provimento
CGJ/TJRN n. 7/2026, Anexo I). A base legal exibida DEVE (SHALL) ser a do ato escolhido. Quando o
ato-alvo é a certidão, o formulário DEVE (SHALL) perguntar também o tipo (sem busca, com busca ou
inteiro teor) e DEVE (SHALL) avisar que o registro e a primeira certidão de nascimento e de óbito
já são gratuitos para qualquer pessoa, sem esta declaração. Uma submissão sem ato-alvo, com
ato-alvo sem previsão de isenção, ou sem o tipo de certidão quando o alvo é a certidão, DEVE
(SHALL) ser recusada no servidor.

O pedido DEVE (SHALL) formalizar a **declaração de hipossuficiência econômica** do Anexo I do
Provimento CGJ/TJRN n. 7/2026, individualmente por pessoa beneficiária: uma declaração na
certidão e na alteração de prenome, e uma por nubente na habilitação de casamento, no mesmo
pedido. Cada declaração DEVE (SHALL) conter:

- o nome completo da pessoa beneficiária (obrigatório) e, opcionalmente, CPF ou RG, data de
  nascimento, profissão, endereço, município/UF, CEP e telefone ou e-mail;
- **quem formaliza** a declaração: a própria pessoa beneficiária, um representante legal (nome,
  CPF ou RG, contato, qualidade em que atua e documento comprobatório) ou assinatura a rogo
  (nome, CPF ou RG e contato de quem assina), com a pessoa beneficiária sempre identificada
  separadamente de quem assina;
- a **declaração** marcada, com o texto visível na íntegra: a pessoa declara, sob as penas da
  lei, não dispor de recursos suficientes para suportar os emolumentos do ato sem prejuízo da
  própria manutenção e da de sua família, e declara ciência de que (a) havendo fundadas razões
  para dúvida o registrador poderá submeter a questão ao Juízo competente, inclusive para
  substituição pelo parcelamento; (b) mesmo assim o ato será praticado de imediato; (c) se o
  benefício for indeferido, poderão ser adotadas medidas para cobrança; (d) informação falsa gera
  responsabilidade civil e criminal; (e) a gratuidade não abrange serviços postais, remessas,
  diligências ou notificações.

O pedido NÃO DEVE (SHALL NOT) exigir comprovante de programa social nem qualquer anexo para ser
protocolado: a declaração é suficiente. O formulário NÃO DEVE (SHALL NOT) mencionar CadÚnico,
programa social ou conferência em sistemas de benefício. Anexar documentos continua possível pelo
campo comum de anexos, nunca exigido. O formulário online NÃO DEVE (SHALL NOT) pedir testemunhas
da assinatura a rogo: elas assinam no papel, e o servidor DEVE (SHALL) recusar testemunhas vindas
do canal online.

As declarações DEVEM (SHALL) ser persistidas no registro do pedido com a data em que foram feitas,
o ato pedido e o tipo de certidão quando houver, como os aceites de LGPD e veracidade já são: a
prova é do controlador. A gratuidade solicitada e o ato pedido DEVEM (SHALL) ficar visíveis ao
operador na tela do pedido e constar do requerimento impresso que o cidadão assina. Solicitar
NÃO DEVE (SHALL NOT) zerar o valor do pedido: conceder é decisão da serventia.

Os formulários dos atos isentáveis NÃO DEVEM (SHALL NOT) mais oferecer a opção de gratuidade: o
caminho é um só. Pedidos protocolados antes desta mudança, com só a data e o ato gravados,
DEVEM (SHALL) continuar legíveis no painel, no requerimento e na declaração em PDF, com os campos
não coletados em branco, sem dado inventado no lugar do que falta.

#### Scenario: A gratuidade aparece na lista de atos do Registro Civil
- **WHEN** o cidadão escolhe a atribuição Registro Civil e vê a tela "Escolha o ato"
- **THEN** "Solicitar gratuidade (isento)" aparece entre os atos, com selo de tramitação

#### Scenario: A entrada não aparece onde nenhum ato é isentável
- **WHEN** o cidadão abre a lista de atos de uma atribuição sem ato com previsão de isenção
- **THEN** a entrada da gratuidade não é oferecida

#### Scenario: O cidadão diz qual ato quer isento
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** o formulário oferece a certidão do RCPN, a habilitação de casamento e a alteração de
  prenome, e mostra a base legal do ato que ele escolher

#### Scenario: A certidão pergunta o tipo e avisa sobre a primeira via
- **WHEN** o cidadão escolhe a certidão como ato-alvo
- **THEN** o formulário pede o tipo (sem busca, com busca, inteiro teor) e mostra o aviso de que
  o registro e a primeira certidão de nascimento e de óbito já são gratuitos sem declaração

#### Scenario: Certidão sem tipo é recusada
- **WHEN** o cidadão envia o pedido de gratuidade com a certidão como alvo e sem escolher o tipo
- **THEN** o pedido não é protocolado e o erro aponta o tipo da certidão

#### Scenario: Gratuidade sem ato-alvo é recusada
- **WHEN** o cidadão envia o pedido de gratuidade sem escolher o ato
- **THEN** o pedido não é protocolado e o erro aponta a escolha do ato

#### Scenario: Ato-alvo sem previsão de isenção é recusado no servidor
- **WHEN** uma submissão chega ao servidor com um ato-alvo que não tem previsão legal de isenção
- **THEN** o servidor recusa, ainda que o cliente tenha sido contornado

#### Scenario: Gratuidade sem a declaração é recusada
- **WHEN** o cidadão preenche o pedido de gratuidade e envia sem marcar a declaração
- **THEN** o pedido não é protocolado e o erro aponta a declaração

#### Scenario: A declaração exibe o texto e as cinco ciências
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** o texto da declaração de insuficiência de recursos e as ciências (a) a (e) estão
  visíveis na íntegra ao lado da marcação, sem menção a CadÚnico ou programa social

#### Scenario: Gratuidade sem anexo é protocolada
- **WHEN** o cidadão envia o pedido de gratuidade com a declaração marcada e nenhum anexo
- **THEN** o pedido é protocolado normalmente

#### Scenario: Habilitação de casamento pede uma declaração por nubente
- **WHEN** o cidadão escolhe a habilitação de casamento como ato-alvo
- **THEN** o formulário pede duas declarações, uma por nubente, e recusa o envio com só uma

#### Scenario: Representante legal é identificado separadamente
- **WHEN** o cidadão informa que a declaração é formalizada por representante legal
- **THEN** o formulário pede nome, CPF ou RG, contato, qualidade e documento comprobatório do
  representante, e o pedido grava beneficiário e representante como pessoas distintas

#### Scenario: Assinatura a rogo online informa quem assina, não as testemunhas
- **WHEN** o cidadão informa que a declaração será assinada a rogo
- **THEN** o formulário pede nome, CPF ou RG e contato de quem assina, não pede testemunhas, e o
  servidor recusa uma submissão online que traga testemunhas

#### Scenario: Quem assina em lugar do beneficiário é obrigatório
- **WHEN** o cidadão escolhe representante legal ou a rogo e envia sem o nome de quem assina
- **THEN** o pedido não é protocolado e o erro aponta o nome de quem assina

#### Scenario: A declaração vira registro datado, com o ato pedido
- **WHEN** um pedido de gratuidade é protocolado
- **THEN** o registro carrega as declarações com a data em que foram feitas, o ato que a isenção
  pede e o tipo de certidão quando houver

#### Scenario: O operador vê, e o papel assina
- **WHEN** o operador abre um pedido de gratuidade
- **THEN** a tela mostra a solicitação e o ato pedido, e o requerimento impresso carrega a
  declaração para o cidadão assinar

#### Scenario: Pedido antigo continua legível
- **WHEN** o operador abre um pedido de gratuidade protocolado antes desta mudança
- **THEN** a tela mostra a gratuidade solicitada com a data e o ato que tem, e a declaração em
  PDF sai com os campos não coletados em branco

## ADDED Requirements

### Requirement: Declaração de hipossuficiência em PDF
O pedido de gratuidade DEVE (SHALL) produzir, além do requerimento, a **declaração de
hipossuficiência econômica** em PDF, fiel aos nove blocos do Anexo I do Provimento CGJ/TJRN
n. 7/2026 e com a identidade visual da serventia: (1) dados da serventia, preenchidos com o nome
e o município do tenant; (2) dados da pessoa beneficiária; (3) o ato-alvo marcado, o tipo de
certidão quando houver, e livro/folha/termo em branco; (4) a declaração e as ciências; (5) local,
data e assinatura da pessoa interessada; (6) representante legal, preenchido só quando houver;
(7) assinatura a rogo, preenchida só quando houver, com espaço para a impressão digital; (8)
testemunhas, preenchidas quando o balcão as colheu e em branco caso contrário; (9) certificação
da presença, sempre em branco para o oficial; e a base normativa no rodapé. Todo campo não
coletado DEVE (SHALL) sair como linha em branco, para preenchimento à mão. Na habilitação de
casamento o arquivo DEVE (SHALL) trazer uma declaração por nubente.

A declaração DEVE (SHALL) ser baixável pelo cidadão na tela de sucesso e na consulta do protocolo,
com a mesma chave de acesso que protege o requerimento, e SÓ DEVE (SHALL) ser oferecida em pedido
que tenha gratuidade. Ela NÃO DEVE (SHALL NOT) fazer parte do requerimento nem de nenhum outro
documento.

#### Scenario: A declaração sai preenchida com o que foi coletado
- **WHEN** o cidadão baixa a declaração de um pedido de gratuidade feito pela própria pessoa
- **THEN** o PDF traz a serventia, o beneficiário, o ato marcado, a declaração e as ciências, com
  os blocos 6, 7, 8 e 9 em branco

#### Scenario: A rogo sai com quem assina e testemunhas em branco
- **WHEN** o cidadão baixa a declaração de um pedido feito a rogo pelo site
- **THEN** o bloco 7 traz quem assina e o bloco 8 traz as duas testemunhas em branco

#### Scenario: Habilitação traz duas declarações
- **WHEN** o cidadão baixa a declaração de um pedido de gratuidade da habilitação de casamento
- **THEN** o arquivo traz uma declaração completa por nubente

#### Scenario: Só com a chave, e só quando há gratuidade
- **WHEN** a rota da declaração é chamada sem a chave de acesso correta, ou para um pedido sem
  gratuidade
- **THEN** a resposta nega, sem gerar documento, e a tela não oferece o botão em pedido sem
  gratuidade

### Requirement: Formulário de declaração em branco disponível sem pedido
O site DEVE (SHALL) oferecer o formulário da declaração de hipossuficiência em branco, em PDF
com a identidade visual da serventia, sem exigir pedido, chave ou sessão, a partir da tela do ato
da gratuidade e da lista de atos do Registro Civil. É o mesmo documento da declaração
preenchida, com todos os campos em branco.

#### Scenario: O cidadão imprime o formulário para preencher antes
- **WHEN** o cidadão abre o link do formulário em branco na tela da gratuidade
- **THEN** recebe o PDF do Anexo I em branco, com a serventia e o município já preenchidos

#### Scenario: Sem RCPN, sem formulário
- **WHEN** a rota do formulário em branco é chamada num tenant sem a atribuição RCPN
- **THEN** a resposta é "não encontrado"

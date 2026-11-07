## MODIFIED Requirements

### Requirement: Catálogo completo de atos com selo de tramitação
O catálogo do núcleo DEVE (SHALL) cobrir os atos das seis atribuições (conferidos contra o sistema
anterior, com base legal), documentos esperados quando houver, finalidade apenas nos atos que a
exigem (certidão não exige, Lei 6.015 art. 17, salvo o inteiro teor do RCPN, CNN art. 117, § 3º) e descrição obrigatória nos atos "outro".

Cada ato DEVE (SHALL) carregar duas informações independentes, porque são duas perguntas
diferentes e um ato responde as duas:

- **modo de tramitação** (`online`, `presential`, `hybrid`): se o pedido se resolve pela internet,
  termina no balcão ou pode terminar de uma das duas formas;
- **só identificação** (sinalizador): se a serventia atende sem pedir papel além da identificação
  do requerente.

A exibição DEVE (SHALL) traduzir cada uma em linguagem direta ("Termina on-line", "Termina no
balcão", "Termina no balcão ou on-line", "Só identificação") e mostrar as duas quando as duas valem.

Nenhum texto do catálogo SHALL afirmar que um ato dispensa o requerimento: o requerimento
assinado é pedido ao fim de todo pedido feito pelo site.

O texto de um ato `online` SHALL dizer que o Gov.br assina o requerimento, sem dar a entender que
essa assinatura conclui o ato. O ato notarial eletrônico SHALL informar que é assinado no
e-Notariado, e os atos de registro e de protesto SHALL NOT mandar o cidadão para essa plataforma.

#### Scenario: Filtro por atribuição do tenant
- **WHEN** um tenant não possui uma atribuição
- **THEN** nenhum ato dela aparece no wizard, e a contagem "N atos" dos cards reflete só os atos disponíveis

#### Scenario: Selo em linguagem direta
- **WHEN** a etapa 2 lista um ato `presential`
- **THEN** o selo mostra "Termina no balcão" com a explicação de que o pedido adianta a análise e o ato termina no balcão

#### Scenario: Escritura e procuração são híbridas
- **WHEN** a etapa 2 de Notas lista escritura pública ou procuração
- **THEN** o selo mostra "Termina no balcão ou on-line", e o cidadão lê que assina no balcão ou no
  e-Notariado, por videoconferência

#### Scenario: Protesto de títulos termina on-line
- **WHEN** a etapa 2 de Protesto lista o protesto de títulos
- **THEN** o selo mostra "Termina on-line", e a lista de documentos pede o título ou documento de
  dívida e o que qualifica o protestante e o devedor

#### Scenario: Pessoas Jurídicas pede o serviço e os detalhes
- **WHEN** o cidadão abre "Registro ou averbação (estatuto, ata, contrato)"
- **THEN** ele escolhe entre registro, averbação ou misto e descreve o que precisa, e o pedido não é
  enviado sem as duas respostas

#### Scenario: Um ato que responde as duas perguntas mostra as duas
- **WHEN** a etapa 2 lista uma certidão, que é `online` e só exige identificação
- **THEN** o cidadão lê "100% on-line" e "Só identificação", e não é obrigado a escolher entre saber
  uma coisa ou a outra

#### Scenario: Ata notarial separa o requerimento do ato
- **WHEN** a etapa 2 de Notas lista a ata notarial
- **THEN** o cidadão lê que o requerimento é pelo Gov.br e que a ata é assinada no e-Notariado, por
  videoconferência

#### Scenario: Nada promete dispensar o requerimento
- **WHEN** o cidadão abre qualquer ato do catálogo
- **THEN** nenhum texto diz que aquele ato não tem requerimento, porque a tela de sucesso pede o
  requerimento assinado em todos eles

#### Scenario: Inteiro teor em papel termina no balcão
- **WHEN** a etapa 2 de Imóveis lista a certidão de inteiro teor em papel de segurança
- **THEN** o cidadão lê "Termina no balcão" e "Só identificação", com o texto de que a retirada é no balcão, e nenhum valor

#### Scenario: Inteiro teor digital termina on-line
- **WHEN** o cidadão abre a certidão de matrícula, inteiro teor digital ou ônus
- **THEN** a opção se chama "Certidão de inteiro teor digital", e um pedido antigo de inteiro teor passa a aparecer com esse nome

#### Scenario: Inteiro teor do RCPN termina no balcão ou on-line
- **WHEN** a etapa 2 do RCPN lista a certidão de inteiro teor (verbum ad verbum)
- **THEN** o selo mostra "Termina no balcão ou on-line", e o cidadão lê que recebe a certidão pelo site ou a retira no balcão

## ADDED Requirements

### Requirement: Qualificação no inteiro teor do RCPN
O ato "Certidão de inteiro teor (verbum ad verbum)" DEVE (SHALL) perguntar qual é o registro. Salvo no óbito, DEVE (SHALL) pedir também, no site e no balcão, quem está pedindo (próprio interessado, advogado ou procurador, ou outra pessoa), a finalidade e se o registrado é falecido, além do grau de parentesco, quando existir. Em pedido por advogado ou procurador, DEVE (SHALL) pedir o nome do representado e orientar o envio do mandato.

O servidor SHALL NOT recusar o pedido por falta do mandato: qualquer pessoa pode enviá-lo, e a serventia o analisa depois do recebimento. As respostas DEVEM (SHALL) sair no requerimento em PDF.

#### Scenario: Advogado pede certidão de nascimento
- **WHEN** um advogado escolhe nascimento e marca o pedido por procuração
- **THEN** o formulário pede a finalidade, o nome do representado e se o registrado é falecido, e orienta anexar o mandato

#### Scenario: Pedido enviado sem mandato
- **WHEN** quem pede por procuração envia o formulário sem anexo
- **THEN** o protocolo é gerado, e o pedido segue para a análise da serventia

#### Scenario: Próprio interessado também informa a finalidade
- **WHEN** o próprio interessado pede uma certidão de casamento em inteiro teor sem preencher a finalidade
- **THEN** o pedido é recusado com erro junto ao campo

#### Scenario: Óbito não pede qualificação
- **WHEN** o cidadão escolhe óbito
- **THEN** o formulário não mostra as perguntas nem a observação, e o servidor não as exige

### Requirement: Observação sobre autorização judicial
O formulário do inteiro teor do RCPN DEVE (SHALL) avisar, antes do envio e salvo no óbito, que registros com dados sensíveis, restritos ou sigilosos só têm certidão com autorização judicial quando quem pede não for o interessado, o representante legal ou um procurador com poderes especiais, e que o pedido é analisado depois do recebimento. O site SHALL NOT decidir se a autorização é necessária.

#### Scenario: Terceiro lê o aviso antes de enviar
- **WHEN** alguém escolhe nascimento e marca "outra pessoa"
- **THEN** o aviso aparece no formulário, e o pedido pode ser enviado

### Requirement: Assinatura do requerimento de inteiro teor do RCPN
A tela de sucesso, as telas de consulta do protocolo e o PDF desse ato DEVEM (SHALL) orientar a assinatura por Gov.br, ICP-Brasil, firma reconhecida em cartório de notas ou assinatura no balcão com o documento de identidade original, e SHALL NOT citar o e-Notariado. Os demais atos mantêm a orientação atual.

#### Scenario: Orientação própria do ato
- **WHEN** o protocolo de inteiro teor do RCPN é emitido
- **THEN** a tela de sucesso, a consulta do protocolo e o PDF citam Gov.br, ICP-Brasil, firma reconhecida e assinatura no balcão

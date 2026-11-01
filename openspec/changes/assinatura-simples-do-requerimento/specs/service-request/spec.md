## ADDED Requirements

### Requirement: Assinatura eletrônica simples do requerimento no pedido pelo site
A etapa 3 do pedido pelo site DEVE (SHALL) terminar num bloco "Revise e assine", que mostra o
conteúdo do requerimento como o PDF o imprime (requerente, pedido, descrição e declarações) e
pede que a pessoa digite o nome completo. O envio DEVE (SHALL) ser um único gesto, "Assinar e
enviar pedido": não existe pedido pelo site sem assinatura. O servidor DEVE (SHALL) conferir o
nome digitado com o nome do requerente, sem diferenciar maiúsculas, acentos ou espaços
repetidos, e recusar o envio com erro no campo quando não conferirem.

Ao protocolar, o pedido DEVE (SHALL) gravar a assinatura: o momento, o nome digitado, o IP de
quem assinou, a versão do texto assinado, uma cópia do conteúdo assinado e o hash SHA-256
desse conteúdo. O conteúdo assinado DEVE (SHALL) incluir a serventia, o protocolo, o ato, os
dados do requerente, a descrição, a finalidade, a informação adicional e o texto das
declarações na versão em vigor. NÃO DEVE (SHALL NOT) incluir dados de apresentação da
serventia (nome, contatos, rodapé), que mudam com o tempo, nem os anexos. O hash DEVE (SHALL)
ser determinístico: quem tem o conteúdo gravado consegue recalculá-lo e chegar ao mesmo valor.

Mudar o texto das declarações DEVE (SHALL) gerar uma nova versão, sem editar a anterior. Uma
assinatura gravada continua conferível pela versão que leva.

O pedido lançado no balcão NÃO DEVE (SHALL NOT) ganhar assinatura eletrônica: o aceite
presencial é o papel assinado.

#### Scenario: Envio sem o nome digitado
- **WHEN** o cidadão aciona o envio com o campo da assinatura vazio
- **THEN** o servidor recusa, aponta o campo e nenhum pedido é gravado

#### Scenario: Nome digitado não confere
- **WHEN** o requerente é "Maria da Silva" e o nome digitado é "Maria Souza"
- **THEN** o servidor recusa com erro no campo da assinatura, dizendo que o nome deve ser o
  mesmo do requerente

#### Scenario: Diferença só de grafia não impede
- **WHEN** o requerente é "José Antônio" e o nome digitado é "jose  antonio"
- **THEN** o pedido é protocolado e o nome gravado na assinatura é o que a pessoa digitou

#### Scenario: O que se revisa é o que se imprime
- **WHEN** o cidadão chega ao bloco "Revise e assine"
- **THEN** vê as mesmas seções e linhas que o PDF do requerimento vai imprimir, com o protocolo
  indicado como atribuído no envio

#### Scenario: A assinatura fica gravada no pedido
- **WHEN** um pedido assinado é protocolado
- **THEN** o registro carrega momento, nome digitado, IP, versão do texto, conteúdo assinado e
  hash, e o hash recalculado do conteúdo gravado é igual ao gravado

#### Scenario: Dois pedidos iguais, hashes diferentes
- **WHEN** a mesma pessoa assina dois pedidos com os mesmos dados
- **THEN** os hashes diferem, porque protocolo e momento fazem parte do conteúdo assinado

#### Scenario: Mudar a apresentação da serventia não muda o hash
- **WHEN** a serventia troca o telefone ou o nome de exibição depois da assinatura
- **THEN** o hash de uma assinatura antiga, recalculado, continua o mesmo

#### Scenario: Balcão sem assinatura eletrônica
- **WHEN** o operador lança um pedido pelo painel
- **THEN** o pedido não grava assinatura eletrônica e segue o fluxo do papel assinado

## MODIFIED Requirements

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer o download do requerimento em PDF pré-preenchido
(dados do pedido, serventia e protocolo impressos). O download do PDF DEVE (SHALL) exigir a
chave de acesso.

Num pedido assinado eletronicamente no site, o PDF DEVE (SHALL) ser a via assinada: gerado a
partir do conteúdo assinado gravado, não dos dados atuais do pedido, e com o carimbo da
assinatura no lugar da orientação de assinar. O carimbo DEVE (SHALL) trazer quem assinou (o
nome digitado), quando, o canal, o protocolo, o IP e o hash, e NÃO DEVE (SHALL NOT) citar
norma além da que a plataforma já cita para o canal, até que a serventia indique o
fundamento. Num pedido assim, a tela de sucesso NÃO DEVE (SHALL NOT) pedir que o requerimento
seja assinado nem enviado: os passos são guardar o protocolo e a chave e baixar a via
assinada. O aviso de firma reconhecida NÃO DEVE (SHALL NOT) aparecer nesse caminho, que não
oferece assinatura de próprio punho.

A consulta do protocolo DEVE (SHALL) continuar aceitando, como opção secundária e sem pedir
por ela, o envio de um requerimento assinado pelo Gov.br. Num pedido sem assinatura
eletrônica gravada (anterior a esta mudança), a tela de sucesso e a consulta DEVEM (SHALL)
continuar oferecendo o PDF para assinatura digital via Gov.br ou de próprio punho, com o aviso
de que a de próprio punho exige reconhecimento de firma em cartório, e o envio do assinado,
sem que a falta do envio trave o registro do pedido.

Em pedido com gratuidade, a tela de sucesso e a consulta do protocolo DEVEM (SHALL) oferecer o
campo "declaração assinada", com o seu envio, opcional e enviável a qualquer momento. A
assinatura eletrônica do requerimento NÃO DEVE (SHALL NOT) cobrir a declaração. Cada arquivo
enviado DEVE (SHALL) ser guardado como via assinada do documento a que se refere; o servidor
DEVE (SHALL) recusar o envio de declaração em pedido sem gratuidade. Um reenvio DEVE (SHALL)
prevalecer sobre o anterior do mesmo documento. A consulta DEVE (SHALL) dizer, por documento,
se a via assinada foi recebida e quando, e DEVE (SHALL) permitir rebaixar cada uma.

O PDF DEVE (SHALL) sair na identidade visual da serventia: papel timbrado com o selo e a cor
primária do tema do tenant, títulos e cabeçalhos de seção no tom de destaque, e rodapé
institucional em todas as páginas. Nenhuma cor DEVE (SHALL) ser específica de uma serventia: o
documento lê a paleta do tema escolhido, como o resto da plataforma.

A chave de acesso NÃO DEVE (SHALL NOT) aparecer em nenhuma página do arquivo do requerimento. Ela
DEVE (SHALL) ser entregue em um segundo arquivo, o comprovante de acesso: um PDF de uma página, com
o mesmo papel timbrado, trazendo protocolo, chave e a orientação de guardá-lo. O nome de cada
arquivo baixado DEVE (SHALL) distinguir os dois.

O comprovante DEVE (SHALL) ser oferecido apenas na tela de sucesso, ao lado do requerimento: é o
momento em que o pedido nasce e a chave é revelada. A consulta de protocolo NÃO DEVE (SHALL NOT)
oferecê-lo: o comprovante é emitido uma vez, ali ou pela serventia no balcão, e não é um arquivo
que se rebaixa a cada consulta.

#### Scenario: PDF protegido pela chave
- **WHEN** a rota do PDF é chamada com protocolo válido e chave errada
- **THEN** a resposta é 404, sem vazar a existência do pedido, qualquer que seja o documento pedido

#### Scenario: A chave não trafega em URL
- **WHEN** o cidadão baixa qualquer um dos dois documentos
- **THEN** protocolo e chave vão no corpo da requisição, nunca em query string (que ficaria no histórico do navegador e nos logs)

#### Scenario: Pedido assinado no site não pede assinatura
- **WHEN** o cidadão chega à tela de sucesso de um pedido sem gratuidade assinado no site
- **THEN** a tela mostra o protocolo, a chave e o download da via assinada, sem passo de
  assinar nem de enviar o requerimento

#### Scenario: A via assinada traz o carimbo
- **WHEN** o cidadão baixa o requerimento de um pedido assinado no site
- **THEN** o PDF traz, no lugar da orientação de assinar, o carimbo com o nome digitado, a data
  e hora, o canal, o protocolo, o IP e o hash gravado

#### Scenario: A via assinada não muda com a correção
- **WHEN** a serventia corrige o nome do requerente depois da assinatura e o cidadão baixa o
  requerimento
- **THEN** o PDF mostra o conteúdo como foi assinado, e o hash impresso é o gravado

#### Scenario: Gov.br continua possível
- **WHEN** o cidadão de um pedido assinado no site envia pela consulta um requerimento assinado
  pelo Gov.br
- **THEN** o arquivo é anexado como via assinada do requerimento, sem que a consulta tenha
  pedido por ele

#### Scenario: Pedido antigo continua pedindo o assinado
- **WHEN** o cidadão abre a consulta de um pedido protocolado sem assinatura eletrônica
- **THEN** a consulta oferece o PDF para assinar e o envio do assinado como antes, e a timeline
  mostra "Aguardando requerimento assinado" até o envio

#### Scenario: Envio do assinado é opcional no pedido antigo
- **WHEN** o cidadão de um pedido sem assinatura eletrônica fecha a tela sem anexar o
  requerimento assinado
- **THEN** o pedido permanece registrado e o assinado pode ser entregue depois (pela consulta ou no balcão)

#### Scenario: O arquivo assinado nunca contém a credencial
- **WHEN** o cidadão assina o requerimento pelo Gov.br e devolve o arquivo assinado
- **THEN** o arquivo que a serventia recebe não contém a chave de acesso, porque ela nunca esteve nesse arquivo

#### Scenario: Gratuidade ainda pede a declaração assinada
- **WHEN** o cidadão abre a tela de sucesso, ou a consulta, de um pedido com gratuidade
  assinado no site
- **THEN** o requerimento aparece como assinado e a tela oferece o download e o envio da
  declaração assinada

#### Scenario: Declaração assinada só onde há declaração
- **WHEN** um envio de "declaração assinada" chega para um pedido sem gratuidade
- **THEN** o servidor recusa e nada é anexado

#### Scenario: Reenvio substitui
- **WHEN** o cidadão envia o requerimento assinado uma segunda vez
- **THEN** a consulta e o painel passam a tratar o segundo arquivo como a via assinada, e o
  primeiro continua listado entre os anexos

#### Scenario: A consulta diz o que chegou
- **WHEN** o cidadão abre a consulta de um pedido com gratuidade assinado no site, sem ter
  enviado a declaração
- **THEN** a timeline mostra "Requerimento assinado em <data>" já concluída e "Aguardando
  declaração assinada"

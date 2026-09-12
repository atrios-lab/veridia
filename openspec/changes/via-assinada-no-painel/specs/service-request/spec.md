## MODIFIED Requirements

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer: (1) download do requerimento em PDF pré-preenchido (dados do
pedido, serventia e protocolo impressos) para assinatura digital via Gov.br ou de
próprio punho, e, onde a assinatura de próprio punho for oferecida (PDF e telas), o aviso de que
ela exige reconhecimento de firma em cartório, dispensado só na assinatura digital; (2) envio do
requerimento assinado ali mesmo, como anexo do pedido, sem que a falta do envio trave o
registro do pedido; (3) os três próximos passos numerados. O download do PDF DEVE (SHALL)
exigir a chave de acesso.

Em pedido com gratuidade, a tela de sucesso e a consulta do protocolo DEVEM (SHALL) oferecer um
segundo campo, "declaração assinada", ao lado do "requerimento assinado", cada um com o seu
envio, ambos opcionais e enviáveis a qualquer momento. Cada arquivo DEVE (SHALL) ser guardado
como via assinada do documento a que se refere; o servidor DEVE (SHALL) recusar o envio de
declaração em pedido sem gratuidade. Um reenvio DEVE (SHALL) prevalecer sobre o anterior do
mesmo documento. A consulta DEVE (SHALL) dizer, por documento, se a via assinada foi recebida e
quando, e DEVE (SHALL) permitir rebaixar cada uma.

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

#### Scenario: Envio do assinado é opcional
- **WHEN** o cidadão fecha a tela de sucesso sem anexar o requerimento assinado
- **THEN** o pedido permanece registrado e o assinado pode ser entregue depois (pela consulta ou no balcão)

#### Scenario: O arquivo assinado nunca contém a credencial
- **WHEN** o cidadão assina o requerimento pelo Gov.br e devolve o arquivo assinado
- **THEN** o arquivo que a serventia recebe não contém a chave de acesso, porque ela nunca esteve nesse arquivo

#### Scenario: Pedido com gratuidade pede os dois assinados
- **WHEN** o cidadão abre a tela de sucesso, ou a consulta, de um pedido com gratuidade
- **THEN** vê dois campos, "requerimento assinado" e "declaração assinada", e pode enviar um,
  outro ou os dois, em momentos diferentes

#### Scenario: Declaração assinada só onde há declaração
- **WHEN** um envio de "declaração assinada" chega para um pedido sem gratuidade
- **THEN** o servidor recusa e nada é anexado

#### Scenario: Reenvio substitui
- **WHEN** o cidadão envia o requerimento assinado uma segunda vez
- **THEN** a consulta e o painel passam a tratar o segundo arquivo como a via assinada, e o
  primeiro continua listado entre os anexos

#### Scenario: A consulta diz o que chegou
- **WHEN** o cidadão abre a consulta de um pedido com gratuidade tendo enviado só o requerimento
- **THEN** a timeline mostra "Requerimento assinado recebido em <data>" e "Aguardando declaração
  assinada", e oferece o rebaixar do requerimento

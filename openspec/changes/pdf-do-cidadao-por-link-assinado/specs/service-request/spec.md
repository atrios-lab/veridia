## MODIFIED Requirements

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer: (1) download do requerimento em PDF pré-preenchido (dados do
pedido, serventia e protocolo impressos) para assinatura digital via Gov.br ou de
próprio punho — e, onde a assinatura de próprio punho for oferecida (PDF e telas), o aviso de que
ela exige reconhecimento de firma em cartório, dispensado só na assinatura digital; (2) envio do requerimento assinado ali mesmo, como anexo do pedido — sem que a
falta do envio trave o registro do pedido; (3) os três próximos passos numerados. O download
do PDF DEVE (SHALL) exigir a chave de acesso.

Todo download de requerimento ou de comprovante oferecido ao cidadão — na tela de sucesso e nas
consultas de protocolo — DEVE (SHALL) abrir em uma aba nova, sem sair da tela de origem: a tela
de sucesso é o único lugar em que a chave aparece, e o cidadão NÃO DEVE (SHALL NOT) perdê-la ao
baixar justamente o arquivo que a guarda.

Baixar DEVE (SHALL) funcionar pelo botão de download do visualizador de PDF do navegador, que
refaz a requisição do documento por GET. Para isso, o requerimento e a declaração de
hipossuficiência DEVEM (SHALL) ser servidos, depois de verificada a chave, por um **link
assinado**: um endereço GET que carrega apenas um token derivado no servidor, válido para um único
documento de um único pedido de uma única serventia, por tempo curto. A chave de acesso NÃO DEVE
(SHALL NOT) fazer parte do token nem ser recuperável a partir dele. Um link com token inválido,
adulterado, expirado ou emitido para outra serventia DEVE (SHALL) responder 404, sem distinguir o
motivo.

O comprovante de acesso, por carregar a própria chave, NÃO DEVE (SHALL NOT) ser servido por link:
ele DEVE (SHALL) ser entregue como download direto na resposta à requisição que traz a chave no
corpo, sem visualizador e sem nova requisição.

O PDF DEVE (SHALL) sair na identidade visual da serventia: papel timbrado com o selo e a cor
primária do tema do tenant, títulos e cabeçalhos de seção no tom de destaque, e rodapé
institucional em todas as páginas. Nenhuma cor DEVE (SHALL) ser específica de uma serventia: o
documento lê a paleta do tema escolhido, como o resto da plataforma.

A chave de acesso NÃO DEVE (SHALL NOT) aparecer em nenhuma página do arquivo do requerimento. Ela
DEVE (SHALL) ser entregue em um segundo arquivo, o comprovante de acesso: um PDF de uma página, com
o mesmo papel timbrado, trazendo protocolo, chave e a orientação de guardá-lo. O nome de cada
arquivo baixado DEVE (SHALL) distinguir os dois, e o nome que o navegador mostra na aba e sugere ao
salvar DEVE (SHALL) ser o do documento (requerimento, comprovante ou declaração, com o protocolo),
nunca o nome da rota.

O comprovante DEVE (SHALL) ser oferecido apenas na tela de sucesso, ao lado do requerimento — é o
momento em que o pedido nasce e a chave é revelada. A consulta de protocolo NÃO DEVE (SHALL NOT)
oferecê-lo: o comprovante é emitido uma vez, ali ou pela serventia no balcão, e não é um arquivo
que se rebaixa a cada consulta.

#### Scenario: PDF protegido pela chave
- **WHEN** a rota do PDF é chamada com protocolo válido e chave errada
- **THEN** a resposta é 404, sem vazar a existência do pedido, qualquer que seja o documento pedido

#### Scenario: A chave não trafega em URL
- **WHEN** o cidadão baixa qualquer um dos documentos do pedido
- **THEN** protocolo e chave vão no corpo da requisição, nunca em query string; o único endereço
  GET que serve um documento carrega um token que não contém a chave nem permite recuperá-la

#### Scenario: Baixar pelo visualizador do navegador funciona
- **WHEN** o requerimento ou a declaração abre na aba nova e o cidadão clica no botão de download
  do visualizador, que busca de novo o endereço da aba por GET
- **THEN** a resposta é o mesmo PDF, com o mesmo nome de arquivo, enquanto o link estiver na
  validade

#### Scenario: Link adulterado, expirado ou de outra serventia
- **WHEN** o endereço GET de um documento é chamado com token alterado, vencido, emitido no domínio
  de outra serventia, ou sem token
- **THEN** a resposta é 404, igual à de chave errada, sem dizer qual foi o problema

#### Scenario: O link serve só o documento para o qual foi emitido
- **WHEN** um token emitido para o requerimento de um pedido é usado para pedir a declaração, ou
  usado com outro protocolo
- **THEN** a resposta é 404

#### Scenario: O comprovante baixa direto
- **WHEN** o cidadão clica em "Baixar comprovante (PDF)" na tela de sucesso
- **THEN** o navegador salva o arquivo `comprovante-<protocolo>.pdf` sem abrir visualizador, e a
  tela de sucesso continua mostrando protocolo e chave

#### Scenario: Baixar não tira o cidadão da tela da chave
- **WHEN** o cidadão clica em "Baixar requerimento (PDF)" na tela de sucesso
- **THEN** o PDF abre em uma aba nova e a tela de sucesso continua mostrando protocolo e chave

#### Scenario: A consulta baixa o requerimento em aba nova
- **WHEN** o cidadão baixa o requerimento preenchido pela consulta de protocolo
- **THEN** o PDF abre em uma aba nova e a consulta permanece aberta onde estava

#### Scenario: A aba e o arquivo têm o nome do documento
- **WHEN** a declaração de hipossuficiência abre na aba nova
- **THEN** a aba se chama pelo título do documento e o nome sugerido ao salvar é
  `declaracao-<protocolo>.pdf`, não "requerimento"

#### Scenario: Envio do assinado é opcional
- **WHEN** o cidadão fecha a tela de sucesso sem anexar o requerimento assinado
- **THEN** o pedido permanece registrado e o assinado pode ser entregue depois (pela consulta ou no balcão)

#### Scenario: O arquivo assinado nunca contém a credencial
- **WHEN** o cidadão assina o requerimento pelo Gov.br e devolve o arquivo assinado
- **THEN** o arquivo que a serventia recebe não contém a chave de acesso, porque ela nunca esteve nesse arquivo

#### Scenario: A credencial é um arquivo à parte
- **WHEN** o comprovante de acesso é gerado
- **THEN** ele tem uma página, traz protocolo e chave, explica para que servem e orienta a guardá-lo

#### Scenario: Os dois arquivos se distinguem ao baixar
- **WHEN** os dois documentos do mesmo pedido são baixados
- **THEN** os nomes dos arquivos identificam qual é o requerimento e qual é o comprovante, ambos carregando o protocolo

#### Scenario: A consulta não reemite o comprovante
- **WHEN** o cidadão abre o pedido na consulta de protocolo com a chave correta
- **THEN** a tela oferece o requerimento e não oferece o comprovante de acesso

#### Scenario: O protocolo continua legível no requerimento
- **WHEN** a serventia recebe apenas o requerimento assinado
- **THEN** o protocolo do pedido está impresso no corpo e no rodapé, o que permite localizar o pedido

#### Scenario: O documento veste a marca da serventia
- **WHEN** duas serventias com temas diferentes geram os documentos do mesmo ato
- **THEN** os arquivos têm a mesma estrutura, texto e ordem, e diferem apenas na paleta e no selo lidos do tenant

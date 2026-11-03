## ADDED Requirements

### Requirement: O pedido não tramita sem o requerimento assinado
O pedido registrado NÃO DEVE (SHALL NOT) ser apresentado ao cidadão como pronto para andar enquanto o requerimento assinado não chegou. A tela de sucesso, `/protocolo` e `/acompanhar` DEVEM (SHALL) avisar que a serventia só dá andamento ao pedido com o requerimento assinado, enviado pelo site ou entregue em papel no balcão. Nenhuma dessas telas DEVE (SHALL NOT) dizer que o pedido segue sem ele.

#### Scenario: Aviso na tela de sucesso
- **WHEN** o cidadão vê a tela de sucesso de um pedido recém-registrado
- **THEN** o passo de baixar e assinar diz que, sem o requerimento assinado, a serventia não dá andamento ao pedido

#### Scenario: O balcão continua sendo um caminho
- **WHEN** o cidadão abre `/protocolo` ou `/acompanhar` de um pedido ainda sem o requerimento assinado
- **THEN** a tela diz que ele pode entregar o requerimento assinado em papel no balcão e que, sem ele, o pedido não tramita

#### Scenario: Nenhuma tela promete andamento sem o assinado
- **WHEN** o cidadão lê o texto sobre a entrega em papel em qualquer uma das telas
- **THEN** nenhum texto diz que o pedido "não trava" ou "continua valendo" sem o requerimento assinado

### Requirement: Confirmação antes de enviar o documento assinado
Escolher o arquivo NÃO DEVE (SHALL NOT) enviá-lo. Todo envio de documento assinado pelo cidadão, na tela de sucesso, em `/protocolo` e em `/acompanhar`, DEVE (SHALL) passar por duas etapas: escolher o arquivo e, com o nome dele visível, marcar a confirmação de que aquele arquivo é o documento deste pedido já assinado, com o aviso de que, se for outro documento, o pedido não tramita na serventia. O botão "Enviar" DEVE (SHALL) ficar desativado até a confirmação ser marcada. O servidor DEVE (SHALL) recusar o envio sem a confirmação, sem armazenar o arquivo. Vale para o requerimento e para a declaração de hipossuficiência, cada um com o texto que o nomeia.

#### Scenario: Escolher o arquivo não envia
- **WHEN** o cidadão escolhe um arquivo válido
- **THEN** nada é enviado, e a tela mostra o nome do arquivo, a confirmação desmarcada, o aviso sobre documento diverso e o botão "Enviar" desativado

#### Scenario: Confirmar libera o envio
- **WHEN** o cidadão marca a confirmação e clica em "Enviar"
- **THEN** o arquivo é anexado ao pedido como documento assinado e a tela mostra que ele foi enviado

#### Scenario: Trocar de arquivo refaz a confirmação
- **WHEN** o cidadão marcou a confirmação e escolhe outro arquivo, ou clica em "Trocar arquivo" depois de um envio
- **THEN** a confirmação volta desmarcada, porque ela vale para um arquivo específico

#### Scenario: Arquivo recusado não chega à confirmação
- **WHEN** o cidadão escolhe um arquivo de tipo ou tamanho não aceito
- **THEN** a tela mostra o motivo da recusa e não oferece a confirmação

#### Scenario: Servidor recusa envio sem confirmação
- **WHEN** a ação de envio recebe protocolo e chave válidos e um arquivo, mas não a confirmação
- **THEN** a resposta é um erro pedindo a confirmação, e nada é anexado ao pedido

#### Scenario: A declaração tem o próprio texto
- **WHEN** o cidadão escolhe o arquivo da declaração de hipossuficiência
- **THEN** a confirmação nomeia a declaração, e não o requerimento

### Requirement: Destaque dos passos de assinatura e envio na tela de sucesso
Na tela de sucesso, o passo de baixar e assinar DEVE (SHALL) trazer uma faixa sólida com texto branco que o marca como obrigatório e uma borda vermelha piscando. A borda DEVE (SHALL) parar de piscar e ficar fixa quando o cidadão aciona o download do requerimento. O passo de enviar DEVE (SHALL) trazer borda vermelha fixa. Depois do envio do requerimento assinado, os dois passos DEVEM (SHALL) voltar à aparência normal. Com a preferência de movimento reduzido, a borda NÃO DEVE (SHALL NOT) piscar e DEVE (SHALL) aparecer fixa desde o início. A vermelha DEVE (SHALL) ser a cor de alerta do tema, igual em todas as serventias, e o destaque NÃO DEVE (SHALL NOT) depender só da cor: a faixa e o aviso dizem o mesmo em texto.

#### Scenario: A tela abre chamando atenção para o passo 2
- **WHEN** a tela de sucesso aparece
- **THEN** o passo 2 está com a faixa de obrigatório e a borda vermelha piscando, e o passo 3 está com a borda vermelha fixa

#### Scenario: Baixar o requerimento para o pisca
- **WHEN** o cidadão aciona "Baixar requerimento (PDF)"
- **THEN** a borda do passo 2 para de piscar e continua vermelha, e o aviso continua na tela

#### Scenario: Enviar encerra o destaque
- **WHEN** o requerimento assinado é enviado pela tela de sucesso
- **THEN** os passos 2 e 3 perdem a borda vermelha, a faixa de obrigatório sai, e o passo 3 mostra o arquivo enviado

#### Scenario: Movimento reduzido não pisca
- **WHEN** o sistema do cidadão pede movimento reduzido
- **THEN** o passo 2 aparece com a borda vermelha fixa, sem animação

## MODIFIED Requirements

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer: (1) download do requerimento em PDF pré-preenchido (dados do
pedido, serventia e protocolo impressos) para assinatura digital via Gov.br ou de
próprio punho — e, onde a assinatura de próprio punho for oferecida (PDF e telas), o aviso de que
ela exige reconhecimento de firma em cartório, dispensado só na assinatura digital; (2) envio do requerimento assinado ali mesmo, como anexo do pedido — sem que a
falta do envio trave o registro do pedido, embora o pedido não tramite sem o requerimento assinado; (3) os três próximos passos numerados. O download
do PDF DEVE (SHALL) exigir a chave de acesso.

O PDF DEVE (SHALL) sair na identidade visual da serventia: papel timbrado com o selo e a cor
primária do tema do tenant, títulos e cabeçalhos de seção no tom de destaque, e rodapé
institucional em todas as páginas. Nenhuma cor DEVE (SHALL) ser específica de uma serventia: o
documento lê a paleta do tema escolhido, como o resto da plataforma.

A chave de acesso NÃO DEVE (SHALL NOT) aparecer em nenhuma página do arquivo do requerimento. Ela
DEVE (SHALL) ser entregue em um segundo arquivo, o comprovante de acesso: um PDF de uma página, com
o mesmo papel timbrado, trazendo protocolo, chave e a orientação de guardá-lo. O nome de cada
arquivo baixado DEVE (SHALL) distinguir os dois.

O comprovante DEVE (SHALL) ser oferecido apenas na tela de sucesso, ao lado do requerimento — é o
momento em que o pedido nasce e a chave é revelada. A consulta de protocolo NÃO DEVE (SHALL NOT)
oferecê-lo: o comprovante é emitido uma vez, ali ou pela serventia no balcão, e não é um arquivo
que se rebaixa a cada consulta.

#### Scenario: PDF protegido pela chave
- **WHEN** a rota do PDF é chamada com protocolo válido e chave errada
- **THEN** a resposta é 404, sem vazar a existência do pedido, qualquer que seja o documento pedido

#### Scenario: A chave não trafega em URL
- **WHEN** o cidadão baixa qualquer um dos dois documentos
- **THEN** protocolo e chave vão no corpo da requisição, nunca em query string (que ficaria no histórico do navegador e nos logs)

#### Scenario: O registro não depende do envio do assinado
- **WHEN** o cidadão fecha a tela de sucesso sem anexar o requerimento assinado
- **THEN** o pedido permanece registrado e o assinado pode ser entregue depois (pela consulta ou no balcão), e o pedido só tramita depois disso

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

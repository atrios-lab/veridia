## MODIFIED Requirements

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer: (1) download do requerimento em PDF pré-preenchido (dados do
pedido, serventia e protocolo impressos) para assinatura digital via Gov.br ou de
próprio punho; (2) envio do requerimento assinado ali mesmo, como anexo do pedido — sem que a
falta do envio trave o registro do pedido; (3) os três próximos passos numerados. O download
do PDF DEVE (SHALL) exigir a chave de acesso.

O PDF DEVE (SHALL) sair na identidade visual da serventia: cabeçalho com o logotipo e a cor
primária do tema do tenant, títulos e réguas no tom de destaque, e rodapé institucional em
todas as páginas. Nenhuma cor DEVE (SHALL) ser específica de uma serventia: o documento lê a
paleta do tema escolhido, como o resto da plataforma.

A chave de acesso NÃO DEVE (SHALL NOT) aparecer nas páginas do requerimento propriamente dito.
Protocolo e chave DEVEM (SHALL) ser impressos em uma página própria, a última do arquivo,
identificada como comprovante de acesso e com a instrução de guardá-la e não anexá-la ao
requerimento assinado. A folha de assinatura DEVE (SHALL) terminar antes dessa página.

#### Scenario: PDF protegido pela chave
- **WHEN** a rota do PDF é chamada com protocolo válido e chave errada
- **THEN** a resposta é 404, sem vazar a existência do pedido

#### Scenario: A chave não trafega em URL
- **WHEN** o cidadão baixa o requerimento pela tela de sucesso
- **THEN** protocolo e chave vão no corpo da requisição, nunca em query string (que ficaria no histórico do navegador e nos logs)

#### Scenario: Envio do assinado é opcional
- **WHEN** o cidadão fecha a tela de sucesso sem anexar o requerimento assinado
- **THEN** o pedido permanece registrado e o assinado pode ser entregue depois (pela consulta ou no balcão)

#### Scenario: A credencial fica fora da folha assinada
- **WHEN** o requerimento é gerado
- **THEN** a chave de acesso aparece uma única vez, na página final de credenciais, e nenhuma seção do corpo do requerimento a contém

#### Scenario: A credencial ocupa a última página
- **WHEN** o cidadão imprime o requerimento e destaca a última folha
- **THEN** o que resta são as páginas do requerimento completas, incluindo o campo de assinatura, sem a chave de acesso

#### Scenario: A credencial se explica sozinha
- **WHEN** a página de credenciais é lida
- **THEN** ela informa o protocolo, a chave, para que servem e a orientação de guardá-la sem anexar ao requerimento assinado

#### Scenario: O documento veste a marca da serventia
- **WHEN** duas serventias com temas diferentes geram o requerimento do mesmo ato
- **THEN** os dois arquivos têm a mesma estrutura, texto e ordem, e diferem apenas na paleta e no logotipo lidos do tenant

#### Scenario: O protocolo continua legível no corpo
- **WHEN** a serventia recebe apenas a folha assinada, sem a página de credenciais
- **THEN** o protocolo do pedido ainda está impresso no corpo e no rodapé, o que permite localizar o pedido

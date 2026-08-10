# service-request

## Purpose

TBD
## Requirements
### Requirement: Validação client-side do formulário com o mesmo schema do servidor
O formulário do pedido DEVE (SHALL) validar os campos no cliente com react-hook-form usando o
mesmo schema Zod do núcleo (`serviceRequestSchema(act)`), sem schema paralelo. Erros DEVEM
(SHALL) aparecer por campo, em português, a partir do blur do campo, e o envio DEVE (SHALL) ser
bloqueado enquanto houver erro de validação no cliente. A validação do servidor DEVE (SHALL)
permanecer integral: o cliente é conveniência, o servidor é a fronteira de confiança.

#### Scenario: Erro apontado sem ida ao servidor
- **WHEN** o cidadão preenche um CPF inválido e sai do campo
- **THEN** a mensagem "CPF inválido." aparece junto ao campo sem requisição ao servidor

#### Scenario: Envio bloqueado com aceite faltante
- **WHEN** o cidadão tenta enviar sem marcar o aceite de LGPD
- **THEN** o formulário não é submetido e o erro aparece junto ao aceite

#### Scenario: Servidor continua validando
- **WHEN** uma submissão chega ao server action sem passar pela validação do cliente (ex.: script)
- **THEN** o servidor rejeita com os mesmos erros de campo de antes

#### Scenario: Erro que só o servidor conhece continua exibido
- **WHEN** o cliente aprova os campos mas o servidor reprova (ex.: anexo inválido ou rate limit)
- **THEN** a mensagem de erro do servidor é exibida no formulário como hoje

### Requirement: Máscaras de CPF e telefone durante a digitação
O campo de CPF DEVE (SHALL) formatar o valor como `000.000.000-00` enquanto o cidadão digita.
O campo de contato DEVE (SHALL) formatar como telefone `(00) 00000-0000` apenas quando o valor
digitado for numérico, preservando a digitação livre de e-mail. A máscara é apresentação: o
servidor DEVE (SHALL) continuar aceitando o valor com ou sem pontuação.

#### Scenario: CPF ganha máscara ao digitar
- **WHEN** o cidadão digita "12345678909" no campo CPF
- **THEN** o campo exibe "123.456.789-09"

#### Scenario: Contato numérico ganha máscara de telefone
- **WHEN** o cidadão digita "84990000000" no campo de contato
- **THEN** o campo exibe "(84) 99000-0000"

#### Scenario: E-mail não é mascarado
- **WHEN** o cidadão digita "voce@exemplo.com" no campo de contato
- **THEN** o valor permanece exatamente como digitado

### Requirement: Catálogo completo de atos com selo de tramitação
O catálogo do núcleo DEVE (SHALL) cobrir os atos das seis atribuições (conferidos contra o sistema
anterior, com base legal), cada ato com modo de tramitação (`identification`, `online`,
`presential`), documentos esperados quando houver, finalidade apenas nos atos que a exigem
(certidão nunca exige — Lei 6.015 art. 17) e descrição obrigatória nos atos "outro". A
exibição DEVE (SHALL) traduzir o modo em linguagem direta: "Só identificação", "100% on-line",
"On-line + presencial".

#### Scenario: Filtro por atribuição do tenant
- **WHEN** um tenant não possui uma atribuição
- **THEN** nenhum ato dela aparece no wizard, e a contagem "N atos" dos cards reflete só os atos disponíveis

#### Scenario: Selo em linguagem direta
- **WHEN** a etapa 2 lista um ato `presential`
- **THEN** o selo mostra "On-line + presencial" com a explicação de que o pedido adianta a análise e o ato termina no balcão

### Requirement: Wizard de solicitação em três etapas
`/solicitar` DEVE (SHALL) guiar o cidadão por Atribuição → Ato → Pedido com indicador de progresso,
cards de atribuição com exemplos do dia a dia (não apenas siglas), possibilidade de trocar a
escolha em qualquer etapa, e — na etapa 3 — o ato escolhido fixo no topo com ação "trocar" e
checklist informativo dos documentos do ato. O estado do wizard DEVE (SHALL) viver na URL (voltar do
navegador funciona).

#### Scenario: Leigo encontra o serviço
- **WHEN** o cidadão abre a etapa 1
- **THEN** cada card mostra o nome da atribuição em linguagem comum com exemplos ("Certidão de nascimento, casamento…") e a contagem de atos

#### Scenario: Trocar sem perder o fluxo
- **WHEN** o cidadão clica "trocar" na etapa 3
- **THEN** ele volta à etapa 2 da mesma atribuição, mantendo a jornada

### Requirement: Formulário do pedido com aceites e anti-spam invisível
O formulário DEVE (SHALL) pedir nome, e-mail/WhatsApp, CPF opcional, descrição (obrigatória quando o
ato exige), finalidade quando o ato exige, anexos opcionais (até 5, imagem ou PDF, validados
no servidor) e aceites obrigatórios de LGPD e veracidade. O anti-spam DEVE (SHALL) ser um honeypot
invisível (campo `website`): sem CAPTCHA. Submissões com honeypot preenchido DEVEM (SHALL) receber
resposta de sucesso falsa sem gravação. A rota DEVE (SHALL) aplicar rate limit.

#### Scenario: Aceites obrigatórios
- **WHEN** o cidadão envia sem marcar um dos aceites
- **THEN** o servidor rejeita com erro de validação apontando o aceite faltante

#### Scenario: Robô cai no honeypot
- **WHEN** uma submissão chega com o campo `website` preenchido
- **THEN** a resposta simula sucesso e nenhum pedido é gravado

#### Scenario: Anexo inválido
- **WHEN** um arquivo que não é imagem nem PDF (ou excede o tamanho máximo) é enviado
- **THEN** o servidor rejeita a submissão com mensagem clara, independentemente do `accept` do input

### Requirement: Protocolo sequencial e chave de acesso exibida uma única vez
Ao gravar, o sistema DEVE (SHALL) gerar protocolo `REQ.AAAA.NNNNNN` (sequência por tenant e ano, sem
colisão sob concorrência) e uma chave de acesso `XXXX-XXXX-XXXX` (alfabeto sem caracteres
ambíguos). A chave DEVE (SHALL) ser armazenada apenas como hash; o texto claro aparece somente na
resposta da submissão (e impresso no PDF do requerimento). O pedido nasce com status `new`,
escopado ao tenant, e a criação DEVE (SHALL) ser auditada.

#### Scenario: Sucesso mostra protocolo e chave uma vez
- **WHEN** a submissão é aceita
- **THEN** a tela de sucesso mostra protocolo e chave com botões copiar e o aviso de que a chave não será reexibida; recarregar a página não a mostra de novo

#### Scenario: Chave não recuperável do banco
- **WHEN** qualquer consulta lê o registro do pedido
- **THEN** apenas o hash da chave existe; o texto claro não está armazenado

### Requirement: Requerimento em PDF e envio do assinado
A tela de sucesso DEVE (SHALL) oferecer: (1) download do requerimento em PDF pré-preenchido (dados do
pedido, serventia e protocolo impressos) para assinatura digital via Gov.br ou de
próprio punho; (2) envio do requerimento assinado ali mesmo, como anexo do pedido — sem que a
falta do envio trave o registro do pedido; (3) os três próximos passos numerados. O download
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

### Requirement: O cartão da exigência entrega o formulário da serventia
O cartão da exigência na consulta de protocolo DEVE (SHALL) oferecer para download o formulário
que a serventia anexou a ela, protegido pelo mesmo par protocolo + chave dos demais documentos
do pedido. O formulário NÃO DEVE (SHALL NOT) aparecer em "Documentos da
serventia" nem herdar o prazo de disponibilidade daquela lista: enquanto a exigência existir, o
formulário existe com ela.

#### Scenario: Download dentro do cartão da exigência
- **WHEN** o cidadão abre a consulta com a chave correta e a exigência tem um formulário anexado
- **THEN** o cartão da exigência mostra o arquivo e o download vai pela rota protegida por chave, com protocolo e chave no corpo da requisição

#### Scenario: Exigência sem formulário não muda
- **WHEN** a exigência não tem formulário anexado
- **THEN** o cartão aparece como hoje, só com o texto e o envio do cumprimento


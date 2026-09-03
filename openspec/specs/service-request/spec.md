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
O campo de telefone DEVE (SHALL) formatar como `(00) 00000-0000` enquanto o cidadão digita, sem
condicional: o campo é só de telefone. O campo de e-mail NÃO DEVE (SHALL NOT) receber máscara. A
máscara é apresentação: o servidor DEVE (SHALL) continuar aceitando o valor com ou sem pontuação.

#### Scenario: CPF ganha máscara ao digitar
- **WHEN** o cidadão digita "12345678909" no campo CPF
- **THEN** o campo exibe "123.456.789-09"

#### Scenario: Telefone ganha máscara ao digitar
- **WHEN** o cidadão digita "84990000000" no campo de telefone
- **THEN** o campo exibe "(84) 99000-0000"

#### Scenario: E-mail não é mascarado
- **WHEN** o cidadão digita "voce@exemplo.com" no campo de e-mail
- **THEN** o valor permanece exatamente como digitado

#### Scenario: Telefone aceito sem pontuação
- **WHEN** uma submissão chega ao servidor com o telefone "84990000000"
- **THEN** o pedido é aceito e o número é gravado

### Requirement: Catálogo completo de atos com selo de tramitação
O catálogo do núcleo DEVE (SHALL) cobrir os atos das seis atribuições (conferidos contra o sistema
anterior, com base legal), documentos esperados quando houver, finalidade apenas nos atos que a
exigem (certidão nunca exige, Lei 6.015 art. 17) e descrição obrigatória nos atos "outro".

Cada ato DEVE (SHALL) carregar duas informações independentes, porque são duas perguntas
diferentes e um ato responde as duas:

- **modo de tramitação** (`online`, `presential`): se o pedido se resolve pela internet ou termina
  no balcão;
- **só identificação** (sinalizador): se a serventia atende sem pedir papel além da identificação
  do requerente.

A exibição DEVE (SHALL) traduzir cada uma em linguagem direta ("100% on-line", "On-line +
presencial", "Só identificação") e mostrar as duas quando as duas valem.

Nenhum texto do catálogo SHALL afirmar que um ato dispensa o requerimento: o requerimento
assinado é pedido ao fim de todo pedido feito pelo site.

#### Scenario: Filtro por atribuição do tenant
- **WHEN** um tenant não possui uma atribuição
- **THEN** nenhum ato dela aparece no wizard, e a contagem "N atos" dos cards reflete só os atos disponíveis

#### Scenario: Selo em linguagem direta
- **WHEN** a etapa 2 lista um ato `presential`
- **THEN** o selo mostra "On-line + presencial" com a explicação de que o pedido adianta a análise e o ato termina no balcão

#### Scenario: Um ato que responde as duas perguntas mostra as duas
- **WHEN** a etapa 2 lista uma certidão, que é `online` e só exige identificação
- **THEN** o cidadão lê "100% on-line" e "Só identificação", e não é obrigado a escolher entre saber
  uma coisa ou a outra

#### Scenario: Nada promete dispensar o requerimento
- **WHEN** o cidadão abre qualquer ato do catálogo
- **THEN** nenhum texto diz que aquele ato não tem requerimento, porque a tela de sucesso pede o
  requerimento assinado em todos eles

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
O formulário DEVE (SHALL) pedir nome, e-mail obrigatório, telefone opcional, CPF opcional,
descrição (obrigatória quando o ato exige), finalidade quando o ato exige, anexos opcionais (até
5, imagem ou PDF, validados no servidor) e aceites obrigatórios de LGPD e veracidade. Os aceites
DEVEM (SHALL) ser persistidos no registro do pedido com a data do consentimento: a prova do
consentimento cabe ao controlador (LGPD art. 8 §2), e um aceite validado e descartado não é
prova. O anti-spam DEVE (SHALL) ser um honeypot invisível (campo `website`): sem CAPTCHA.
Submissões com honeypot preenchido DEVEM (SHALL) receber resposta de sucesso falsa sem gravação.
A rota DEVE (SHALL) aplicar rate limit.

#### Scenario: Aceites obrigatórios
- **WHEN** o cidadão envia sem marcar um dos aceites
- **THEN** o servidor rejeita com erro de validação apontando o aceite faltante

#### Scenario: Aceites gravados como prova
- **WHEN** um pedido é protocolado com os dois aceites marcados
- **THEN** o registro do pedido carrega os aceites com a data do consentimento, consultáveis depois

#### Scenario: Robô cai no honeypot
- **WHEN** uma submissão chega com o campo `website` preenchido
- **THEN** a resposta simula sucesso e nenhum pedido é gravado

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

### Requirement: E-mail de confirmação do protocolo
Todo pedido protocolado pelo site DEVE (SHALL) render uma confirmação por e-mail para o endereço
informado: protocolo e a instrução de guardar o número e a chave mostrados na tela; a chave NÃO
SHALL constar do e-mail. O envio SHALL ser fire-and-forget: falha de e-mail nunca falha o
protocolo. Pedidos gravados antes desta mudança, cujo contato não é um endereço de e-mail, NÃO
SHALL gerar tentativa de envio.

#### Scenario: Confirmação enviada
- **WHEN** o pedido é criado com e-mail "maria@exemplo.com"
- **THEN** chega um e-mail "Pedido recebido" com o número do protocolo e sem a chave

#### Scenario: Falha de e-mail não derruba o protocolo
- **WHEN** o envio do e-mail falha
- **THEN** o pedido é protocolado normalmente e o cidadão vê protocolo e chave na tela

#### Scenario: Pedido antigo sem e-mail
- **WHEN** um aviso de andamento é disparado para um pedido antigo cujo contato é "(84) 99999-0000"
- **THEN** nenhum e-mail é tentado e o andamento é registrado normalmente

### Requirement: Identificação do solicitante por e-mail obrigatório e telefone opcional
O formulário público do pedido DEVE (SHALL) pedir a identificação em dois campos separados:
**e-mail**, obrigatório e validado como endereço, e **telefone**, opcional, aceito como número
brasileiro com DDD (10 ou 11 dígitos). O núcleo DEVE (SHALL) rejeitar o pedido sem e-mail válido,
e o servidor DEVE (SHALL) continuar sendo a fronteira de validação: um envio que contorne o
cliente recebe os mesmos erros de campo.

O telefone informado DEVE (SHALL) ser gravado junto ao pedido e ficar visível ao operador na tela
do pedido e no requerimento impresso. Um pedido sem telefone DEVE (SHALL) ser protocolado
normalmente.

#### Scenario: Pedido sem e-mail é recusado
- **WHEN** o cidadão envia o formulário com o campo de e-mail vazio
- **THEN** o pedido não é protocolado e o erro aparece junto ao campo de e-mail

#### Scenario: E-mail malformado é recusado
- **WHEN** o cidadão preenche "maria@" e sai do campo
- **THEN** a mensagem de e-mail inválido aparece junto ao campo, sem requisição ao servidor

#### Scenario: Telefone é opcional
- **WHEN** o cidadão preenche e-mail válido e deixa o telefone em branco
- **THEN** o pedido é protocolado e a tela do pedido mostra o telefone vazio, sem erro

#### Scenario: Telefone inválido é recusado
- **WHEN** o cidadão preenche o telefone com menos de 10 dígitos
- **THEN** o pedido não é protocolado e o erro aparece junto ao campo de telefone

#### Scenario: Telefone chega ao operador
- **WHEN** um pedido é protocolado com telefone "(84) 99000-0000"
- **THEN** o operador vê esse telefone na tela do pedido e no requerimento impresso

#### Scenario: Pedido antigo continua legível
- **WHEN** o operador abre um pedido protocolado antes desta mudança, cujo contato é um telefone
- **THEN** o contato é exibido como está gravado, sem erro e sem reescrita do registro

### Requirement: Solicitação de gratuidade (ISENTO) nos atos que a lei isenta
A gratuidade DEVE (SHALL) ser pedida por uma entrada própria na lista de atos, e não por uma opção
dentro do formulário de outro ato. A tela "Escolha o ato" do Registro Civil DEVE (SHALL) exibir
"Solicitar gratuidade (isento)" ao lado dos demais atos da atribuição, com o mesmo selo de
tramitação que os outros exibem. A entrada SÓ DEVE (SHALL) aparecer em atribuição que tenha ao
menos um ato com previsão legal de isenção no catálogo.

Escolhida a entrada, o formulário DEVE (SHALL) perguntar **qual ato** o cidadão quer isento,
oferecendo apenas os atos daquela atribuição que a lei isenta para beneficiário de programa
social: a certidão de RCPN (CF art. 5º, LXXVI; Lei 6.015 art. 30 §1º) e a habilitação de casamento
(CC art. 1.512, parágrafo único). A base legal exibida DEVE (SHALL) ser a do ato escolhido. Uma
submissão sem ato-alvo, ou com um ato-alvo sem previsão de isenção, DEVE (SHALL) ser recusada no
servidor.

O pedido de gratuidade SÓ DEVE (SHALL) ser aceito com:

- a **declaração específica** marcada: o requerente declara ser beneficiário de programa social
  (CadÚnico/CRAS), autoriza a conferência nos sistemas governamentais de benefício social e
  declara ciência de que informação falsa responde criminalmente (Código Penal art. 299) e
  civilmente (Código Civil arts. 186 e 927), com a lei e o artigo visíveis no próprio texto;
- **pelo menos um anexo**, a documentação que comprova o benefício. O formulário DEVE (SHALL)
  listar quais documentos servem, em vez de pedir "a documentação" sem dizer qual, e a lista DEVE
  (SHALL) se apresentar como exemplos, com uma entrada aberta: são muitos programas sociais, e
  uma lista lida como exaustiva afasta quem tem direito mas não se vê nela.

A declaração DEVE (SHALL) ser persistida no registro do pedido com a data em que foi feita e com o
ato que a isenção pede, como os aceites de LGPD e veracidade já são: a prova é do controlador. A
gratuidade solicitada e o ato pedido DEVEM (SHALL) ficar visíveis ao operador na tela do pedido e
constar do requerimento impresso que o cidadão assina. Solicitar NÃO DEVE (SHALL NOT) zerar o
valor do pedido: conceder é decisão da serventia, depois de conferir.

Os formulários dos atos isentáveis NÃO DEVEM (SHALL NOT) mais oferecer a opção de gratuidade: o
caminho é um só. Pedidos protocolados antes desta mudança, sem ato-alvo gravado, DEVEM (SHALL)
continuar legíveis no painel e no requerimento, sem ato inventado no lugar do que falta.

#### Scenario: A gratuidade aparece na lista de atos do Registro Civil
- **WHEN** o cidadão escolhe a atribuição Registro Civil e vê a tela "Escolha o ato"
- **THEN** "Solicitar gratuidade (isento)" aparece entre os atos, com selo de tramitação

#### Scenario: A entrada não aparece onde nenhum ato é isentável
- **WHEN** o cidadão abre a lista de atos de uma atribuição sem ato com previsão de isenção
- **THEN** a entrada da gratuidade não é oferecida

#### Scenario: O cidadão diz qual ato quer isento
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** o formulário oferece a certidão de RCPN e a habilitação de casamento, e mostra a base
  legal do ato que ele escolher

#### Scenario: Gratuidade sem ato-alvo é recusada
- **WHEN** o cidadão envia o pedido de gratuidade sem escolher o ato
- **THEN** o pedido não é protocolado e o erro aponta a escolha do ato

#### Scenario: Ato-alvo sem previsão de isenção é recusado no servidor
- **WHEN** uma submissão chega ao servidor com um ato-alvo que não tem previsão legal de isenção
- **THEN** o servidor recusa, ainda que o cliente tenha sido contornado

#### Scenario: Gratuidade sem a declaração é recusada
- **WHEN** o cidadão preenche o pedido de gratuidade e envia sem marcar a declaração específica
- **THEN** o pedido não é protocolado e o erro aponta a declaração

#### Scenario: O cidadão lê o que precisa anexar antes de anexar
- **WHEN** o cidadão abre o pedido de gratuidade
- **THEN** a tela lista os documentos que comprovam o benefício, diz que um deles basta e deixa
  claro que são exemplos, com uma entrada aberta para outros programas sociais

#### Scenario: Gratuidade sem documentação é recusada
- **WHEN** o cidadão envia o pedido de gratuidade sem nenhum anexo
- **THEN** o pedido não é protocolado e o erro diz que a documentação do benefício precisa ser
  anexada

#### Scenario: A declaração vira registro datado, com o ato pedido
- **WHEN** um pedido de gratuidade é protocolado
- **THEN** o registro carrega a declaração com a data em que foi feita e o ato que a isenção pede

#### Scenario: O operador vê, e o papel assina
- **WHEN** o operador abre um pedido de gratuidade
- **THEN** a tela mostra a solicitação e o ato pedido, e o requerimento impresso carrega a
  declaração para o cidadão assinar

#### Scenario: O formulário da certidão não pede mais gratuidade
- **WHEN** o cidadão abre o formulário da certidão de RCPN
- **THEN** nenhuma opção de gratuidade aparece ali, e o pedido segue sem declaração nem anexo
  obrigatório

#### Scenario: Pedido antigo continua legível
- **WHEN** o operador abre um pedido de gratuidade protocolado antes desta mudança
- **THEN** a solicitação e a data aparecem como sempre, sem ato pedido e sem erro

### Requirement: Prazo estimado informado na emissão do protocolo
Ao concluir a solicitação, junto do número do protocolo, o sistema SHALL exibir o prazo estimado de análise como data-limite ("até DD/MM/AAAA"), contado da emissão em dias úteis, com o prazo legal do ato pedido. Para ato sem prazo legal, SHALL usar o prazo padrão do cartório. A previsão SHALL vir acompanhada da ressalva de que os pedidos são atendidos por ordem de chegada.

#### Scenario: Confirmação da solicitação online
- **WHEN** o cidadão conclui o envio de um pedido de serviço e a tela de confirmação exibe o protocolo
- **THEN** a confirmação exibe a data-limite contada em dias úteis com o prazo legal daquele ato, e a ressalva da ordem de chegada

### Requirement: Situação do prazo na consulta do protocolo
A consulta pública do protocolo SHALL exibir a situação do prazo de um pedido de serviço em andamento: em qual dia útil da contagem ele está ("dia X de N") e a data prevista, com a ressalva da ordem de chegada. O prazo exibido SHALL ser, nesta ordem: o gravado no pedido quando o cartório o ajustou, o prazo legal do ato, ou o padrão do cartório. No dia do protocolo, quando nenhum dia útil correu ainda, SHALL informar que a contagem começa no próximo dia útil. Pedidos em andamento terminal (concluído, indeferido, cancelado, arquivado) SHALL NOT exibir prazo. Quando a data prevista já passou, a consulta SHALL informar que o prazo está em revisão pelo cartório, sem usar a palavra "vencido" nem contagem de dias de atraso.

#### Scenario: Pedido dentro do prazo
- **WHEN** o cidadão consulta um protocolo de pedido em andamento cuja data prevista ainda não passou
- **THEN** a consulta mostra o dia atual da contagem, o total de dias e a data prevista

#### Scenario: Contagem em dias úteis
- **WHEN** o prazo de um pedido atravessa fim de semana ou feriado nacional
- **THEN** esses dias não avançam a contagem nem a data prevista

#### Scenario: Consulta no mesmo dia do protocolo
- **WHEN** o cidadão consulta um protocolo emitido hoje
- **THEN** a consulta informa que a contagem começa no próximo dia útil, com a data prevista

#### Scenario: Pedido com prazo ajustado pelo cartório
- **WHEN** o cartório zerou ou ajustou o prazo do pedido e o cidadão consulta o protocolo
- **THEN** a contagem e a data prevista exibidas refletem o prazo gravado, não o prazo legal do ato

#### Scenario: Data prevista já passou
- **WHEN** o cidadão consulta um protocolo em andamento cuja data prevista já passou
- **THEN** a consulta informa que o prazo está em revisão pelo cartório, sem exibir dias de atraso

#### Scenario: Pedido encerrado
- **WHEN** o cidadão consulta um protocolo em andamento terminal
- **THEN** a consulta não exibe bloco de prazo

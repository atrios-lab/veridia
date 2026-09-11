## MODIFIED Requirements

### Requirement: Lançar pedido manualmente para atendimento presencial

`/admin/pedidos/novo` SHALL usar o mesmo vocabulário atribuição → ato do wizard público
(`/solicitar`) e o mesmo schema de validação (`serviceRequestSchema`), num formulário único. O
pedido lançado SHALL gerar protocolo e chave de acesso como no site público, e SHALL ficar marcado
como recebido presencialmente.

Quando o ato escolhido é "Solicitar gratuidade (isento)", o formulário SHALL exibir o bloco da
declaração de hipossuficiência com os mesmos campos do site (ato-alvo, tipo de certidão quando
for certidão, uma declaração por pessoa beneficiária, quem formaliza, representante legal ou quem
assina a rogo) e, quando a assinatura for a rogo, SHALL pedir as duas testemunhas (nome, CPF ou
RG, contato), obrigatórias nesse caso. O formulário SHALL linkar o formulário em branco do Anexo I
para entregar ao cidadão. Depois de protocolar, a tela de sucesso SHALL oferecer a impressão da
declaração preenchida ao lado do requerimento.

#### Scenario: Pedido lançado gera protocolo e chave

- **WHEN** o operador preenche e envia o formulário de lançamento manual
- **THEN** o pedido é criado com protocolo `REQ.AAAA.NNNNNN` e chave de acesso, mostrados na
  própria tela

#### Scenario: Pedido lançado aparece na fila marcado como presencial

- **WHEN** o operador abre a fila depois de lançar um pedido manualmente
- **THEN** o pedido aparece na lista e seu histórico mostra que foi lançado no balcão pela pessoa
  que o lançou

#### Scenario: Validação segue a mesma regra do ato

- **WHEN** o ato escolhido exige finalidade e o operador não a preenche
- **THEN** o formulário recusa o envio com o mesmo erro que o wizard público mostraria

#### Scenario: Gratuidade é protocolada no balcão

- **WHEN** o operador escolhe "Solicitar gratuidade (isento)", preenche o ato-alvo, o
  beneficiário e marca a declaração
- **THEN** o pedido é protocolado com a declaração gravada, e a tela de sucesso oferece imprimir
  a declaração preenchida e o requerimento

#### Scenario: A rogo no balcão exige as duas testemunhas

- **WHEN** o operador informa assinatura a rogo e envia sem as duas testemunhas
- **THEN** o formulário recusa o envio apontando as testemunhas, e com elas o pedido é
  protocolado com as testemunhas gravadas

#### Scenario: Erro de validação da gratuidade aponta o campo na tela

- **WHEN** o operador envia a gratuidade sem escolher o ato-alvo
- **THEN** o erro aparece junto ao campo do ato-alvo, nunca só como mensagem genérica

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo.
Enquanto uma chave recém-emitida estiver visível na tela, o painel DEVE (SHALL) oferecer também
o comprovante de acesso para impressão; fora desse momento, NÃO DEVE (SHALL NOT) existir caminho
no painel que produza a chave em claro.

Em pedido com gratuidade, o detalhe DEVE (SHALL) oferecer também a impressão da **declaração de
hipossuficiência** preenchida (Anexo I do Provimento CGJ/TJRN n. 7/2026), pela mesma sessão, com
o mesmo conteúdo do arquivo que o cidadão baixa, registrada na auditoria. O painel DEVE (SHALL)
oferecer ainda o formulário em branco, para entregar a quem preenche à mão.

#### Scenario: Folha para assinar no balcão
- **WHEN** o operador aciona a impressão num pedido sem requerimento assinado
- **THEN** recebe o requerimento em PDF do pedido, sem chave de acesso em página nenhuma

#### Scenario: Via assinada quando ela existe
- **WHEN** o pedido tem um requerimento assinado devolvido pelo cidadão
- **THEN** a ação de imprimir abre o arquivo assinado, que é o papel que o balcão arquiva

#### Scenario: Comprovante só enquanto a chave está na tela
- **WHEN** o operador acabou de emitir uma nova chave e ela está visível
- **THEN** pode imprimir o comprovante de acesso com essa chave; ao sair da tela, o caminho desaparece

#### Scenario: Rota autenticada por sessão
- **WHEN** a rota de impressão é chamada sem sessão com `requests.manage`
- **THEN** a resposta nega o acesso, sem gerar documento

#### Scenario: Declaração preenchida impressa do detalhe
- **WHEN** o operador aciona a impressão da declaração num pedido com gratuidade
- **THEN** recebe o Anexo I preenchido com o que o pedido tem, os campos não coletados em branco,
  e a auditoria registra a impressão

#### Scenario: Declaração não existe em pedido sem gratuidade
- **WHEN** a rota da declaração é chamada para um pedido sem gratuidade
- **THEN** a resposta é "não encontrado" e o detalhe não oferece a ação

## ADDED Requirements

### Requirement: Desfecho da gratuidade
O detalhe de um pedido com gratuidade DEVE (SHALL) oferecer, a quem tem `requests.manage`, o
registro do **desfecho** da gratuidade: concedida, submetida ao Juízo Corregedor (Provimento
CGJ/TJRN n. 7/2026, art. 11), indeferida, ou substituída por parcelamento; e a remoção do
desfecho, para corrigir. O desfecho DEVE (SHALL) ser gravado com data e autor, aparecer no
histórico do pedido e na pill da gratuidade ("Gratuidade concedida em <data>"), e ser registrado
na auditoria. Registrar o desfecho NÃO DEVE (SHALL NOT) mudar o andamento nem o valor do pedido:
o ato segue de imediato (art. 11 §3º) e o valor continua sendo do operador. O servidor DEVE
(SHALL) recusar um desfecho em pedido sem gratuidade ou vindo de quem não tem a permissão.

#### Scenario: Operador concede a gratuidade
- **WHEN** o operador registra "concedida" num pedido com gratuidade
- **THEN** a pill passa a dizer "Gratuidade concedida em <data>", o histórico ganha o evento com o
  autor, e o andamento e o valor do pedido ficam como estavam

#### Scenario: Dúvida vai ao Juízo sem parar o pedido
- **WHEN** o operador registra "submetida ao Juízo"
- **THEN** o desfecho fica gravado e o pedido continua podendo mudar de andamento normalmente

#### Scenario: Desfecho é reversível
- **WHEN** o operador remove o desfecho registrado por engano
- **THEN** a pill volta a "Gratuidade solicitada" e o histórico mostra a remoção

#### Scenario: Sem gratuidade, sem desfecho
- **WHEN** a ação de desfecho é chamada para um pedido sem gratuidade, ou por quem não tem
  `requests.manage`
- **THEN** o servidor recusa e nada é gravado

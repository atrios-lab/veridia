## ADDED Requirements

### Requirement: Assinatura eletrônica à vista no detalhe do pedido
O detalhe de um pedido assinado eletronicamente no site DEVE (SHALL) mostrar, junto dos dados
do solicitante, "Assinado eletronicamente em <data e hora>" com o nome digitado. Quando algum
campo do conteúdo assinado (nome, contato, telefone, CPF, finalidade ou descrição) foi
corrigido depois da assinatura, o detalhe DEVE (SHALL) avisar que os dados atuais diferem dos
assinados, e a correção continua registrada no histórico como hoje. O formulário de correção
de um pedido assinado DEVE (SHALL) avisar, antes de salvar, que a via assinada não muda com a
correção. Pedidos sem assinatura eletrônica NÃO DEVEM (SHALL NOT) mostrar nem a linha nem o
aviso.

#### Scenario: Pedido assinado no site
- **WHEN** o operador abre o detalhe de um pedido assinado no site
- **THEN** vê "Assinado eletronicamente em <data e hora>" com o nome que a pessoa digitou

#### Scenario: Correção depois da assinatura
- **WHEN** o operador corrige o CPF de um pedido assinado e volta ao detalhe
- **THEN** o detalhe avisa que os dados atuais diferem dos assinados, e o histórico registra a
  correção com autor e data

#### Scenario: Corrigir a data do atendimento não acusa diferença
- **WHEN** o operador ajusta só a data/hora do pedido
- **THEN** o aviso de diferença não aparece, porque o momento da assinatura não é um campo
  corrigível

#### Scenario: Pedido do balcão
- **WHEN** o operador abre um pedido lançado no balcão
- **THEN** o detalhe não mostra linha de assinatura eletrônica

## MODIFIED Requirements

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido tem via assinada, a ação DEVE (SHALL)
apresentar-se como "Requerimento assinado" e abri-la, mantendo como ação secundária a geração
de uma folha nova com os dados atuais e sem carimbo ("Gerar sem assinatura"). A via assinada
é, nesta ordem: o requerimento assinado anexado mais recente (enviado pelo Gov.br ou marcado
pelo balcão); senão, num pedido assinado eletronicamente no site, a via eletrônica, gerada a
partir do conteúdo assinado com o carimbo da assinatura. Enquanto uma chave recém-emitida
estiver visível na tela, o painel DEVE (SHALL) oferecer também o comprovante de acesso para
impressão; fora desse momento, NÃO DEVE (SHALL NOT) existir caminho no painel que produza a
chave em claro.

Em pedido com gratuidade, o detalhe DEVE (SHALL) oferecer também a declaração de
hipossuficiência preenchida (Anexo I do Provimento CGJ/TJRN n. 7/2026), pela mesma sessão, com
o mesmo conteúdo do arquivo que o cidadão baixa, registrada na auditoria; e, quando o pedido tem
a declaração assinada anexada, a ação DEVE (SHALL) apresentar-se como via assinada e abrir esse
arquivo, com a geração como secundária, pela mesma regra do requerimento. A assinatura
eletrônica do requerimento NÃO DEVE (SHALL NOT) fazer a declaração passar por assinada. O
painel DEVE (SHALL) oferecer ainda o formulário em branco, para entregar a quem preenche à mão.

Abrir uma via assinada pelo painel, anexada ou eletrônica, DEVE (SHALL) ser registrado na
auditoria como a geração é, nomeando o documento (requerimento ou declaração) e o pedido.

A seção de anexos do detalhe DEVE (SHALL) permitir ao operador marcar um arquivo que anexa como
"requerimento assinado" ou "declaração assinada", para que o papel assinado à mão no balcão e
digitalizado conte como via assinada.

#### Scenario: Folha para assinar no balcão
- **WHEN** o operador aciona a impressão num pedido sem via assinada nenhuma
- **THEN** recebe o requerimento em PDF do pedido, sem chave de acesso em página nenhuma

#### Scenario: Via eletrônica de um pedido assinado no site
- **WHEN** o pedido foi assinado no site e não tem requerimento assinado anexado
- **THEN** a ação principal é "Requerimento assinado" e abre o PDF gerado do conteúdo assinado,
  com o carimbo; "Gerar sem assinatura" gera a folha com os dados atuais, sem carimbo

#### Scenario: Via assinada quando ela existe
- **WHEN** o pedido tem um requerimento assinado devolvido pelo cidadão
- **THEN** a ação principal é "Requerimento assinado" e abre o arquivo anexado, mesmo que o
  pedido também tenha assinatura eletrônica; "Gerar sem assinatura" continua gerando o PDF novo

#### Scenario: Declaração assinada quando ela existe
- **WHEN** o pedido tem a declaração assinada devolvida pelo cidadão
- **THEN** a ação principal é "Declaração assinada" e abre o arquivo; "Gerar sem assinatura"
  continua gerando a declaração preenchida com o carimbo

#### Scenario: Assinatura do requerimento não assina a declaração
- **WHEN** um pedido com gratuidade foi assinado no site e não tem declaração assinada anexada
- **THEN** o requerimento aparece como assinado e a declaração continua oferecida para gerar,
  sem a ação "Declaração assinada"

#### Scenario: Reenvio prevalece
- **WHEN** o pedido tem dois requerimentos assinados anexados
- **THEN** a ação abre o mais recente

#### Scenario: Abrir a via assinada deixa rastro
- **WHEN** o operador abre a via assinada do requerimento, anexada ou eletrônica, ou a da declaração
- **THEN** a auditoria registra a ação nomeando o documento, no histórico do pedido

#### Scenario: Papel do balcão vira via assinada
- **WHEN** o operador anexa um arquivo marcando "requerimento assinado"
- **THEN** o cabeçalho do detalhe passa a oferecer "Requerimento assinado" abrindo esse arquivo

#### Scenario: Comprovante só enquanto a chave está na tela
- **WHEN** o operador acabou de emitir uma nova chave e ela está visível
- **THEN** pode imprimir o comprovante de acesso com essa chave; ao sair da tela, o caminho desaparece

#### Scenario: Rota autenticada por sessão
- **WHEN** a rota de impressão é chamada sem sessão com `requests.manage`
- **THEN** a resposta nega o acesso, sem gerar documento

#### Scenario: Declaração preenchida impressa do detalhe
- **WHEN** o operador aciona a geração da declaração num pedido com gratuidade
- **THEN** recebe o Anexo I preenchido com o que o pedido tem, os campos não coletados em branco,
  e a auditoria registra a impressão

#### Scenario: Declaração não existe em pedido sem gratuidade
- **WHEN** a rota da declaração é chamada para um pedido sem gratuidade
- **THEN** a resposta é "não encontrado" e o detalhe não oferece a ação

## MODIFIED Requirements

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo,
mantendo a geração como ação secundária ("Gerar sem assinatura"). Vale o anexo mais recente do
documento. Enquanto uma chave recém-emitida estiver visível na tela, o painel DEVE (SHALL)
oferecer também o comprovante de acesso para impressão; fora desse momento, NÃO DEVE (SHALL NOT)
existir caminho no painel que produza a chave em claro.

Em pedido com gratuidade, o detalhe DEVE (SHALL) oferecer também a declaração de
hipossuficiência preenchida (Anexo I do Provimento CGJ/TJRN n. 7/2026), pela mesma sessão, com
o mesmo conteúdo do arquivo que o cidadão baixa, registrada na auditoria; e, quando o pedido tem
a declaração assinada anexada, a ação DEVE (SHALL) apresentar-se como via assinada e abrir esse
arquivo, com a geração como secundária, pela mesma regra do requerimento. O painel DEVE (SHALL)
oferecer ainda o formulário em branco, para entregar a quem preenche à mão.

Abrir uma via assinada pelo painel DEVE (SHALL) ser registrado na auditoria como a geração é,
nomeando o documento e o anexo aberto.

A seção de anexos do detalhe DEVE (SHALL) permitir ao operador marcar um arquivo que anexa como
"requerimento assinado" ou "declaração assinada", para que o papel assinado à mão no balcão e
digitalizado conte como via assinada.

#### Scenario: Folha para assinar no balcão
- **WHEN** o operador aciona a impressão num pedido sem requerimento assinado
- **THEN** recebe o requerimento em PDF do pedido, sem chave de acesso em página nenhuma

#### Scenario: Via assinada quando ela existe
- **WHEN** o pedido tem um requerimento assinado devolvido pelo cidadão
- **THEN** a ação principal é "Requerimento assinado" e abre o arquivo anexado; "Gerar sem
  assinatura" continua gerando o PDF novo

#### Scenario: Declaração assinada quando ela existe
- **WHEN** o pedido tem a declaração assinada devolvida pelo cidadão
- **THEN** a ação principal é "Declaração assinada" e abre o arquivo; "Gerar sem assinatura"
  continua gerando a declaração preenchida com o carimbo

#### Scenario: Reenvio prevalece
- **WHEN** o pedido tem dois requerimentos assinados anexados
- **THEN** a ação abre o mais recente

#### Scenario: Abrir a via assinada deixa rastro
- **WHEN** o operador abre a via assinada do requerimento ou da declaração
- **THEN** a auditoria registra a ação com o documento e o id do anexo

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

## ADDED Requirements

### Requirement: Imprimir o requerimento no balcão
O detalhe do pedido DEVE (SHALL) oferecer a impressão do requerimento em PDF, gerado pela sessão
do painel sem exigir a chave de acesso, com a mesma identidade visual e o mesmo conteúdo do
arquivo que o cidadão baixa. Quando o pedido já tem o requerimento assinado anexado, a ação
DEVE (SHALL) apresentar-se como via assinada e abrir esse arquivo em vez de gerar um novo.
Enquanto uma chave recém-emitida estiver visível na tela, o painel DEVE (SHALL) oferecer também
o comprovante de acesso para impressão; fora desse momento, NÃO DEVE (SHALL NOT) existir caminho
no painel que produza a chave em claro.

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

### Requirement: Corrigir os dados protocolados
O detalhe do pedido DEVE (SHALL) permitir corrigir nome, contato, CPF, finalidade, descrição e a
data/hora do atendimento — o balcão lança o atendimento depois, e o protocolo vale pelo momento
do atendimento. Cada correção DEVE (SHALL) entrar no histórico do pedido. O ato e o número de
protocolo NÃO DEVEM (SHALL NOT) ser editáveis: trocar o ato muda a atribuição e a base legal do
que já foi protocolado.

#### Scenario: Erro de digitação corrigido sem refazer o pedido
- **WHEN** o operador corrige o nome do solicitante e salva
- **THEN** o detalhe e a consulta do cidadão passam a mostrar o nome corrigido, e o histórico registra quem corrigiu e quando

#### Scenario: Data e hora do atendimento
- **WHEN** o operador ajusta a data/hora de um pedido lançado depois do atendimento presencial
- **THEN** o pedido passa a valer pelo momento informado, refletido no detalhe e na consulta

#### Scenario: O ato não se edita
- **WHEN** o formulário de edição é aberto
- **THEN** não há campo para trocar o ato nem o protocolo

#### Scenario: Só com permissão
- **WHEN** a ação de salvar é chamada sem sessão com `requests.manage`
- **THEN** nada é alterado e a resposta nega a permissão

### Requirement: Formulário anexado à exigência
A serventia DEVE (SHALL) poder anexar a uma exigência o formulário que o cidadão precisa
imprimir e apresentar. O arquivo pertence à exigência: DEVE (SHALL) aparecer no cartão dela — no
painel e na consulta do cidadão — e NÃO DEVE (SHALL NOT) entrar na lista "Documentos da
serventia" nem no prazo de disponibilidade dessa lista. Excluir a exigência ou o pedido leva o
formulário junto.

#### Scenario: Serventia anexa o modelo
- **WHEN** o operador anexa um formulário a uma exigência pendente
- **THEN** o arquivo aparece no cartão da exigência com nome legível e pode ser aberto dali

#### Scenario: Cidadão baixa pelo cartão da exigência
- **WHEN** o cidadão abre a consulta com protocolo e chave e a exigência tem formulário
- **THEN** o cartão da exigência oferece o download, protegido pela mesma chave dos demais documentos

#### Scenario: Fora da lista de entregas
- **WHEN** um formulário está anexado a uma exigência
- **THEN** ele não aparece em "Entrega ao cidadão" no painel nem em "Documentos da serventia" na consulta

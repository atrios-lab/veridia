# admin-office-settings

## Purpose

TBD

## Requirements

### Requirement: Tela de Configurações com faixa de abas

A rota `/admin/configuracoes` SHALL exigir sessão válida na serventia do host e a permissão
`content.edit`, checadas no servidor. A tela SHALL apresentar uma faixa com as quatro abas
previstas — Serventia, Identidade Visual, Encarregado e Cobrança. Abas ainda não implementadas
SHALL aparecer inertes, marcadas como "em breve" e não focáveis por teclado.

#### Scenario: Aba Serventia é a inicial

- **WHEN** um usuário com `content.edit` abre `/admin/configuracoes`
- **THEN** a aba Serventia aparece selecionada e seu conteúdo é o renderizado

#### Scenario: Aba não implementada não navega

- **WHEN** o usuário clica em "Cobrança"
- **THEN** nada acontece: a URL não muda e a aba Serventia continua selecionada

#### Scenario: Acesso sem permissão

- **WHEN** um usuário autenticado sem `content.edit` requisita `/admin/configuracoes`
- **THEN** o servidor recusa o acesso, mesmo que a pessoa tenha chegado por URL direta

### Requirement: Edição de horário e contatos da serventia

O bloco "Atendimento e contato" SHALL permitir editar a frase de horário de atendimento, o
telefone, o WhatsApp e o e-mail da serventia. Os quatro campos SHALL ser obrigatórios e validados
no servidor com o mesmo schema que descreve `contacts` e `openingHours` no `TenantSchema`. Uma
gravação bem-sucedida SHALL registrar entrada em `audit_log` com o autor, a ação e a serventia.

#### Scenario: Gravação válida

- **WHEN** o usuário altera o telefone para um valor válido e aciona "Salvar"
- **THEN** o valor é persistido como override da serventia e a tela confirma a gravação

#### Scenario: E-mail inválido é recusado no servidor

- **WHEN** o formulário é enviado com `contato@` no campo de e-mail
- **THEN** nada é gravado e o campo de e-mail exibe a mensagem de erro correspondente

#### Scenario: Campo obrigatório vazio

- **WHEN** o formulário é enviado com o horário de atendimento em branco
- **THEN** nada é gravado e o campo exibe erro; os demais valores digitados permanecem no
  formulário

#### Scenario: Toda gravação deixa rastro

- **WHEN** uma gravação é aceita
- **THEN** existe uma linha em `audit_log` identificando quem gravou, em qual serventia e quando

### Requirement: O que a serventia salva aparece no site público

O valor salvo no painel SHALL substituir, na leitura, o valor equivalente vindo da configuração
em código, em todo lugar do site público que exibe horário ou contato. A configuração em código
SHALL continuar sendo o valor exibido enquanto não houver override gravado.

#### Scenario: Override vale no site público

- **WHEN** a serventia salva um novo telefone no painel e um visitante abre a home
- **THEN** o novo telefone é o exibido no rodapé e na página de contato

#### Scenario: Sem override, vale a configuração

- **WHEN** uma serventia nunca salvou nada nesta aba
- **THEN** o site público exibe exatamente os valores do arquivo de configuração dela

#### Scenario: Override é por serventia

- **WHEN** a serventia A salva um telefone novo
- **THEN** a serventia B continua exibindo o próprio telefone, inalterado

### Requirement: Dados estruturais aparecem em leitura, nunca em edição

O bloco "Dados da serventia" SHALL exibir o nome e o CNS em campos não editáveis, com selo
"Somente leitura", e SHALL listar as seis atribuições legais (RCPN, NOTAS, RI, PROTESTO, RTD,
RCPJ) com o estado de cada uma **declarado em texto** — "Delegada" ou "Não delegada" — e não
apenas por cor ou forma. Nenhuma requisição do painel SHALL ser capaz de alterar nome, CNS ou
atribuições.

O estado da atribuição NÃO SHALL ser desenhado como interruptor, caixa de seleção ou qualquer
outra forma que sugira controle — nem mesmo desabilitada. O bloco NÃO SHALL conter elemento
interativo algum.

Abaixo da lista SHALL vir a razão: a atribuição é delegação do tribunal, não preferência da
serventia; é ela que decide quais seções o site oferece e quais atos o cidadão pode pedir; e a
atualização passa pelo suporte.

#### Scenario: Atribuição não delegada é mostrada, não escondida

- **WHEN** a serventia não tem a atribuição RCPJ
- **THEN** a linha RCPJ aparece na lista, esmaecida, com marcador vazado e o texto "Não delegada"

#### Scenario: Não há o que clicar

- **WHEN** o usuário procura alterar uma atribuição pela tela
- **THEN** não existe interruptor, caixa de seleção nem botão no bloco, e o texto abaixo da lista
  diz que a atualização passa pelo suporte

#### Scenario: O estado sobrevive sem cor

- **WHEN** a tela é lida por leitor de tela ou impressa em preto e branco
- **THEN** cada atribuição continua dizendo "Delegada" ou "Não delegada" em palavras

#### Scenario: Forjar o envio não altera dado estrutural

- **WHEN** uma requisição para a action de gravação inclui campos de nome, CNS ou atribuições
- **THEN** eles são ignorados e apenas horário e contatos são considerados

### Requirement: Prazo padrão dos atos sem prazo legal
As Configurações SHALL oferecer a edição do prazo padrão dos atos que a lei não fixa prazo, em dias úteis, com 10 dias como valor inicial quando o cartório nunca salvou um. Este valor SHALL NOT sobrepor o prazo legal de um ato que tenha um. O servidor SHALL validar que o valor está entre 1 e 365 dias e SHALL gravar o override no padrão dos demais ajustes do cartório, com auditoria. O valor salvo SHALL passar a valer para os pedidos desses atos sem prazo gravado individualmente, inclusive os anteriores à alteração.

#### Scenario: Cartório nunca configurou o prazo
- **WHEN** o operador abre as Configurações sem nenhum prazo salvo
- **THEN** o campo exibe o valor inicial definido em código

#### Scenario: Ato com prazo legal ignora o padrão do cartório
- **WHEN** o cartório salva um prazo padrão e um cidadão pede um ato que a lei fixa prazo
- **THEN** o protocolo nasce com o prazo legal do ato, não com o padrão salvo

#### Scenario: Salvar um prazo diferente
- **WHEN** o operador salva um prazo válido diferente do default
- **THEN** o valor passa a ser usado nos atos sem prazo legal e a alteração consta na auditoria

#### Scenario: Valor inválido é recusado
- **WHEN** o operador tenta salvar um prazo fora do intervalo de 1 a 365 dias
- **THEN** o servidor recusa a gravação e a tela informa o erro

#### Scenario: Prazo do canal LGPD não é afetado
- **WHEN** o cartório altera o prazo padrão dos pedidos
- **THEN** o prazo do canal de direitos do titular permanece 15 dias corridos, fixado por lei

## ADDED Requirements

### Requirement: Publicação tem tipo, data de entrada e data de saída

Toda publicação SHALL ter um tipo (proclamas, aviso ou edital), título, texto, data de entrada no
site e data de saída. Uma publicação sem data de entrada SHALL ser tratada como rascunho, ainda
não publicada.

#### Scenario: Rascunho sem data de entrada
- **WHEN** o operador salva uma publicação sem preencher a data de entrada
- **THEN** ela é gravada no estado Rascunho, sem aparecer no site público

#### Scenario: Data de saída obrigatória ao publicar
- **WHEN** o operador tenta publicar (definir a data de entrada) sem informar a data de saída
- **THEN** o servidor recusa, exigindo a data de saída

### Requirement: Proclamas vem com saída pré-preenchida em 15 dias

Ao criar uma publicação do tipo proclamas, o formulário SHALL pré-preencher a data de saída com 15
dias após a data de entrada informada, ajustável pelo operador antes de salvar.

#### Scenario: Sugestão de 15 dias
- **WHEN** o operador escolhe o tipo "Proclamas" e informa a data de entrada
- **THEN** a data de saída é pré-preenchida com 15 dias depois, e o operador pode alterá-la

#### Scenario: Aviso e edital não têm sugestão
- **WHEN** o operador escolhe o tipo "Aviso" ou "Edital"
- **THEN** a data de saída não é pré-preenchida — o operador escolhe livremente

### Requirement: Vigência é sempre calculada por data, sem ação manual

Uma publicação SHALL aparecer no site público exatamente entre sua data de entrada e sua data de
saída, incluídas, e SHALL deixar de aparecer sozinha no dia seguinte à data de saída, sem que
ninguém precise arquivá-la manualmente para isso.

#### Scenario: Publicação some sozinha na expiração
- **WHEN** a data corrente passa da data de saída de uma publicação, sem intervenção manual
- **THEN** ela não aparece mais no site público nem na aba "No site" do painel — aparece em
  "Arquivadas"

### Requirement: Lista em abas com edição e arquivamento manual

O painel SHALL listar as publicações em três abas — No site, Agendadas, Arquivadas — cada uma
com a contagem de itens, além do estado Rascunho. Toda publicação não arquivada SHALL poder ser
editada, e SHALL oferecer "Arquivar agora" para tirá-la do site antes da data de saída.

#### Scenario: Arquivar antes do prazo
- **WHEN** o operador aciona "Arquivar agora" numa publicação que está "No site"
- **THEN** ela deixa de aparecer no site imediatamente e passa para a aba "Arquivadas"

#### Scenario: Edição não reabre uma arquivada
- **WHEN** o operador edita uma publicação já arquivada
- **THEN** as alterações são salvas, mas ela continua arquivada — reaparecer no site exige uma
  nova data de saída no futuro

### Requirement: Publicar exige a permissão de publicação

Criar e editar uma publicação (incluindo enquanto rascunho) SHALL exigir a permissão
`content.edit`. Definir a data de entrada pela primeira vez — o ato de publicar — SHALL exigir
adicionalmente a permissão `content.publish`.

#### Scenario: Rascunho sem permissão de publicar
- **WHEN** um usuário com `content.edit` mas sem `content.publish` salva uma publicação sem data
  de entrada
- **THEN** o rascunho é salvo normalmente

#### Scenario: Publicar recusado sem a permissão
- **WHEN** um usuário sem `content.publish` tenta salvar uma data de entrada pela primeira vez
- **THEN** o servidor recusa a ação, mesmo que a interface permita preencher o campo

### Requirement: Pré-visualização mostra exatamente o que o site exibe

O formulário SHALL mostrar uma pré-visualização de como a publicação aparece no site público,
refletindo tipo, título e texto conforme digitados, antes de salvar.

#### Scenario: Pré-visualização acompanha a digitação
- **WHEN** o operador altera o título ou o texto no formulário
- **THEN** a pré-visualização ao lado reflete a mudança sem precisar salvar

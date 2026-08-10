# office-publications Specification

## Purpose
O que a serventia publica e por quanto tempo: proclamas de casamento, avisos e editais, com entrada e saída marcadas por data de calendário e vigência calculada em leitura. Cobre o painel que publica e a página `/editais` que o cidadão lê, organizada pelos setores que as atribuições da serventia permitem.

## Requirements

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

### Requirement: Edital pertence a um setor
A publicação DEVE (SHALL) poder carregar um setor dentre os de `NOTICE_SECTOR_ATTRIBUTION`.
Proclamas (`marriageBanns`) pertencem sempre ao setor `proclamas`, sem pergunta ao operador. Um
edital (`publicNotice`) DEVE (SHALL) escolher o setor no formulário do painel, e as opções DEVEM
(SHALL) ser apenas os setores que as atribuições da serventia permitem. Aviso (`notice`) não tem
setor. Publicações antigas sem setor continuam válidas: setor ausente agrupa como edital geral
da serventia.

#### Scenario: Proclamas não perguntam setor
- **WHEN** o operador cria uma publicação do tipo Proclamas
- **THEN** o formulário não oferece escolha de setor e a publicação sai no setor `proclamas`

#### Scenario: Edital escolhe entre os setores da serventia
- **WHEN** o operador cria um Edital numa serventia sem a atribuição PROTESTO
- **THEN** o setor `protesto` não está entre as opções

#### Scenario: Linha antiga sem setor não quebra
- **WHEN** uma publicação criada antes desta mudança está vigente
- **THEN** ela aparece na página pública, agrupada como edital geral da serventia

### Requirement: A página pública de editais entrega o que está vigente, por setor
A página `/editais` DEVE (SHALL) exibir as publicações vigentes dos tipos Proclamas e Edital,
renderizadas no servidor, agrupadas por setor, cada setor com sua explicação legal fixa (tipo de
edital e base legal). Só aparecem setores com publicação vigente; sem nenhuma, a página DEVE
(SHALL) dizer honestamente que não há edital publicado. Avisos (`notice`) NÃO DEVEM (SHALL NOT)
aparecer nesta página: são conteúdo da home. A vigência é a mesma calculada em
`src/core/publications` — rascunho, agendada, expirada e arquivada não aparecem.

#### Scenario: Publicação vigente aparece com seu setor
- **WHEN** existe um proclamas vigente e a página é aberta
- **THEN** o setor `proclamas` aparece com o título, o corpo e a data de publicação do edital

#### Scenario: Vazio honesto
- **WHEN** não há nenhuma publicação vigente dos tipos Proclamas ou Edital
- **THEN** a página informa que não há edital publicado no momento, sem listar setores vazios

#### Scenario: Fora de vigência não aparece
- **WHEN** um edital expirou ontem ou está agendado para amanhã
- **THEN** ele não aparece na página

#### Scenario: Aviso não vaza para os editais
- **WHEN** existe um Aviso vigente
- **THEN** ele aparece na home e não aparece em `/editais`

#### Scenario: Seção desligada continua desligada
- **WHEN** a serventia tem a seção `editais` desabilitada
- **THEN** a página responde como as demais seções desligadas, sem listar nada

### Requirement: Publicação carrega o arquivo do edital
A publicação DEVE (SHALL) poder ter um anexo — o documento do edital em PDF ou imagem, validado
pelos mesmos limites de tipo e tamanho dos demais anexos da plataforma. O texto da publicação
continua obrigatório: o anexo é o documento assinado, não o substituto do que o cidadão lê na
página. Trocar o arquivo DEVE (SHALL) apagar o anterior do armazenamento. A rota que serve o
anexo DEVE (SHALL) entregá-lo apenas quando a publicação está vigente: rascunho, agendada,
expirada ou arquivada respondem como inexistentes, mesmo para quem souber o identificador.

#### Scenario: Edital com o documento anexado
- **WHEN** o operador publica um edital com o PDF anexado
- **THEN** a página pública mostra o texto e oferece o download do documento

#### Scenario: Rascunho não vaza o arquivo
- **WHEN** alguém chama a rota do anexo de uma publicação em rascunho, com o id correto
- **THEN** a resposta é 404, como se não existisse

#### Scenario: Trocar o arquivo não deixa órfão
- **WHEN** o operador anexa outro arquivo a uma publicação que já tinha um
- **THEN** o anterior é apagado do armazenamento e só o novo permanece

#### Scenario: Publicação sem anexo continua válida
- **WHEN** um aviso ou um edital é publicado sem arquivo
- **THEN** a publicação aparece normalmente, sem link de download

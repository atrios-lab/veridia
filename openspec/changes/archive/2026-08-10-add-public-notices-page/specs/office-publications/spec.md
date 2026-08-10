## ADDED Requirements

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

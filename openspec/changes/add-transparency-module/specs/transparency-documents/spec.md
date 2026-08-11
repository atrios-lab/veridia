# Transparency Documents

## ADDED Requirements

### Requirement: Envio de documento entra como rascunho

O painel SHALL aceitar upload de documento público (somente PDF, até 10 MB) com categoria, nome e ano/vigência, e o documento SHALL entrar com estado `draft` — nunca direto no site.

#### Scenario: Envio válido

- **WHEN** a operadora envia um PDF com categoria "Tabela de emolumentos", nome e vigência preenchidos
- **THEN** o documento aparece no topo da lista do painel com a pill "Rascunho" e não aparece na página pública

#### Scenario: Arquivo recusado

- **WHEN** o arquivo não é PDF ou passa de 10 MB
- **THEN** o envio é recusado com mensagem junto ao campo e nada é gravado

### Requirement: Publicar e despublicar sem diálogo

Publicar um rascunho e despublicar um documento publicado SHALL ser ações de um clique, sem diálogo de confirmação — ambas são reversíveis. Despublicar SHALL tirar o documento do site mantendo o arquivo no painel, com o estado "Despublicado" e a data em que saiu do ar.

#### Scenario: Publicar rascunho

- **WHEN** a operadora clica "Publicar" num rascunho
- **THEN** o documento passa a `published` e aparece na página pública na posição que ocupa na lista

#### Scenario: Despublicar

- **WHEN** a operadora clica "Despublicar" num documento publicado
- **THEN** o documento sai da página pública, permanece na lista do painel como "Despublicado" com "fora do site desde <mês/ano>", e oferece "Publicar de novo"

### Requirement: Remover é destrutivo, confirmado e auditado

Remover SHALL ser a única ação destrutiva da lista: apagar o registro e o arquivo. Ela MUST passar pelo diálogo de confirmação padrão do painel e MUST gravar `recordAudit` na função de dados que deleta.

#### Scenario: Remoção confirmada

- **WHEN** a operadora clica "Remover" e confirma no diálogo
- **THEN** o registro e o arquivo somem, e o `audit_log` ganha uma linha com ação `transparency.document.delete`, o ator e o alvo

#### Scenario: Remoção cancelada

- **WHEN** a operadora clica "Remover" e volta no diálogo
- **THEN** nada muda

### Requirement: A ordem da lista é a ordem do site

Cada documento SHALL ter uma posição explícita. As setas ↑/↓ SHALL mover o documento uma posição sem diálogo, e a página pública SHALL listar os publicados exatamente nessa ordem.

#### Scenario: Mover para cima

- **WHEN** a operadora clica ↑ num documento que não é o primeiro
- **THEN** ele troca de posição com o anterior, no painel e no site

#### Scenario: Extremos

- **WHEN** o documento é o primeiro (ou o último)
- **THEN** a seta ↑ (ou ↓) está desabilitada

### Requirement: Filtro por categoria

A lista do painel SHALL poder ser filtrada por categoria, com "Todas as categorias" como padrão.

#### Scenario: Filtrar

- **WHEN** a operadora escolhe uma categoria no seletor
- **THEN** a lista mostra só os documentos daquela categoria, mantendo a ordem

### Requirement: Página pública lista documentos publicados

A página `/transparencia` SHALL listar os documentos com estado `published`, agrupados na ordem do painel, cada um com nome, categoria, ano/vigência, tamanho e link para o PDF. Rascunhos e despublicados MUST NOT aparecer.

#### Scenario: Cidadão abre a página

- **WHEN** o cidadão acessa /transparencia de um tenant com documentos publicados
- **THEN** vê a lista na ordem definida no painel e consegue abrir cada PDF

#### Scenario: Nada publicado

- **WHEN** o tenant não tem documento publicado
- **THEN** a página explica que os documentos ainda serão publicados, sem quebrar

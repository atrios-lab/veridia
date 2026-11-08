# transparency-documents Specification

## Purpose
Documentos públicos (tabelas de emolumentos, custas, avisos) que a serventia publica na página
de transparência, com rascunho, publicação, retirada e ordem definida pelo painel.
## Requirements
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

A página `/transparencia` SHALL listar os documentos com estado `published` agrupados por categoria.
Os grupos SHALL seguir a ordem da primeira aparição de cada categoria na ordem do painel, e os
documentos dentro de cada grupo SHALL seguir a ordem do painel. Cada documento SHALL mostrar nome,
ano/vigência, tamanho e acesso ao PDF. Nas categorias "Tabela de emolumentos" e "Tabela de custas",
o primeiro documento do grupo SHALL aparecer em destaque como vigente, e os demais SHALL ficar
recolhidos sob "Versões anteriores (n)". Nas demais categorias, todos os documentos do grupo SHALL
aparecer lado a lado, sem recolhimento. Rascunhos e despublicados MUST NOT aparecer.

#### Scenario: Cidadão abre a página

- **WHEN** o cidadão acessa /transparencia de um tenant com documentos publicados
- **THEN** vê os documentos agrupados por categoria, na ordem definida no painel, e consegue abrir
  cada PDF

#### Scenario: Tabela com versão anterior

- **WHEN** o tenant tem publicadas a "Tabela de custas 2026" e, logo abaixo no painel, a "Tabela de
  custas 2025"
- **THEN** o grupo "Tabela de custas" mostra a de 2026 em destaque, e a de 2025 só aparece ao abrir
  "Versões anteriores (1)"

#### Scenario: Avisos não são versões

- **WHEN** o tenant tem dois documentos publicados na categoria "Aviso"
- **THEN** os dois aparecem no grupo "Aviso", sem "Versões anteriores"

#### Scenario: Ordem dos grupos vem do painel

- **WHEN** a operadora move um documento de "Tabela de emolumentos" para cima de todos os de
  "Tabela de custas"
- **THEN** o grupo "Tabela de emolumentos" passa a vir antes do grupo "Tabela de custas" na página

#### Scenario: Nada publicado

- **WHEN** o tenant não tem documento publicado
- **THEN** a página explica que os documentos ainda serão publicados, sem quebrar


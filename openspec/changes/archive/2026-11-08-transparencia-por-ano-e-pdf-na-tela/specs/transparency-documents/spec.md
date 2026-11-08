## MODIFIED Requirements

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

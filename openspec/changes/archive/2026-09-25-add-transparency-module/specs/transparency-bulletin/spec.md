# Transparency Bulletin

## ADDED Requirements

### Requirement: Saldo calculado, nunca digitado

O formulário do boletim SHALL receber mês, ano e quatro valores — atos praticados, arrecadação bruta, tributos pagos (FCRCPN, FRMP, FDJ, FUNAF, ISS) e despesas — e o saldo final SHALL ser calculado como `arrecadação − tributos − despesas` por função pura no core, exibido em tempo real no formulário e no preview. Não SHALL existir campo de saldo editável.

#### Scenario: Valores digitados

- **WHEN** a operadora digita 48.230,10 de arrecadação, 9.612,44 de tributos e 21.480,00 de despesas
- **THEN** o saldo aparece como R$ 17.137,66 no formulário e no preview, sem ação extra

#### Scenario: Centavos exatos

- **WHEN** os valores têm centavos
- **THEN** o cálculo é exato em centavos (sem erro de ponto flutuante) — valores tratados como inteiros em centavos

### Requirement: Pré-visualização fiel ao site

Ao lado do formulário o painel SHALL mostrar a pré-visualização do boletim exatamente como sai no site: cabeçalho com a marca do tenant e CNS, título "Boletim Mensal, <Mês> de <Ano>", período, blocos "De onde veio" e "Para onde foi", saldo em destaque e o rodapé legal (LAI e resoluções).

#### Scenario: Preview acompanha o formulário

- **WHEN** a operadora altera qualquer valor ou o mês
- **THEN** a pré-visualização reflete a mudança imediatamente

### Requirement: Preliminar e consolidado

O boletim SHALL ser publicado como `preliminary` ou `consolidated`. Preliminar SHALL sair no site com a etiqueta dourada "Dados preliminares"; consolidado sem etiqueta. Publicar um boletim para um mês que já tem boletim SHALL substituir o anterior daquele mês — nunca dois boletins do mesmo mês no site.

#### Scenario: Publicar preliminar

- **WHEN** a operadora publica agosto/2026 como preliminar
- **THEN** o boletim sai no site com a etiqueta "Dados preliminares"

#### Scenario: Consolidar o mês

- **WHEN** a operadora publica de novo agosto/2026 como consolidado
- **THEN** o boletim consolidado substitui o preliminar de agosto, a etiqueta some, e a lista de publicados mostra um único agosto/2026

### Requirement: Lista de boletins publicados

O painel SHALL listar os boletins publicados com mês/ano, situação (Preliminar/Consolidado) e acesso ao PDF, mais recente primeiro. O cabeçalho do módulo SHALL mostrar o último publicado.

#### Scenario: Ver lista

- **WHEN** a operadora abre a aba Boletim mensal
- **THEN** vê os boletins já publicados com situação e "Ver PDF"

### Requirement: PDF público com a marca do tenant

Cada boletim publicado SHALL existir como PDF gerado pelo servidor com a identidade do tenant (mesma infra dos demais PDFs do produto), acessível ao cidadão pela página /transparencia sem chave nem login.

#### Scenario: Cidadão abre o boletim

- **WHEN** o cidadão clica num boletim em /transparencia
- **THEN** recebe o PDF com o cabeçalho do cartório, os quatro valores, o saldo e o rodapé legal — e a etiqueta "Dados preliminares" quando a situação for preliminar

#### Scenario: Isolamento por tenant

- **WHEN** a rota do PDF é chamada com id de boletim de outro tenant
- **THEN** responde 404

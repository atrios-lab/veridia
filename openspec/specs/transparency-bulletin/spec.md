# transparency-bulletin Specification

## Purpose
Boletim mensal publicado pela serventia na página pública de transparência, com o PDF gerado
pelo servidor na identidade do tenant.
## Requirements
### Requirement: Saldo calculado, nunca digitado

Com a opção de publicar arrecadação, despesas e saldo ligada, o saldo final SHALL ser calculado
como `arrecadação − (soma dos fundos + ISS) − despesas` por função pura no core, exibido em tempo
real no formulário e no preview com o rótulo "Saldo final (emolumentos e outras receitas)". O saldo
SHALL poder ser negativo e ser exibido como tal. Não SHALL existir campo de saldo editável.

#### Scenario: Valores digitados

- **WHEN** a operadora digita 7.978,12 de arrecadação, fundos e ISS que somam 2.652,59 e 8.069,31 de
  despesas
- **THEN** o saldo aparece como R$ -2.743,78 no formulário e no preview, sem ação extra

#### Scenario: Centavos exatos

- **WHEN** os valores têm centavos
- **THEN** o cálculo é exato em centavos (sem erro de ponto flutuante) — valores tratados como inteiros em centavos

### Requirement: Pré-visualização fiel ao site

Ao lado do formulário o painel SHALL mostrar a pré-visualização do boletim exatamente como sai no
site: cabeçalho com a marca do tenant e CNS, título "Boletim Mensal, <Mês> de <Ano>", período, atos
praticados, as rubricas com o subtotal e o detalhe por fundo, o total recolhido aos fundos, a linha
do ISS à parte e o rodapé legal; e, com a opção de publicar a parcela privada ligada, a arrecadação,
as despesas e o saldo final. O rodapé SHALL citar o art. 6º, § 3º, da Res. CNJ 215/2015, com a
redação da Res. CNJ 670/2025.

#### Scenario: Preview acompanha o formulário

- **WHEN** a operadora altera qualquer valor ou o mês
- **THEN** a pré-visualização reflete a mudança imediatamente, incluindo subtotais, totais e saldo

#### Scenario: Preview com a opção desligada

- **WHEN** a opção de publicar arrecadação, despesas e saldo está desligada
- **THEN** a pré-visualização não mostra arrecadação, despesas nem saldo

#### Scenario: Rodapé cita a norma

- **WHEN** a operadora olha o rodapé da pré-visualização
- **THEN** vê a referência ao art. 6º, § 3º, da Res. CNJ 215/2015, com a redação da Res. CNJ
  670/2025

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

Cada boletim publicado SHALL existir como PDF gerado pelo servidor com a identidade do tenant
(mesma infra dos demais PDFs do produto), acessível ao cidadão pela página /transparencia sem chave
nem login. O conteúdo do PDF SHALL ser o mesmo da pré-visualização e SHALL seguir a opção de
publicar a parcela privada vigente no momento em que o PDF é gerado.

#### Scenario: Cidadão abre o boletim

- **WHEN** o cidadão clica num boletim em /transparencia de uma serventia com a opção ligada
- **THEN** recebe o PDF com o cabeçalho do cartório, os atos praticados, a arrecadação, as rubricas
  com o detalhe por fundo, o total recolhido aos fundos, a linha do ISS, as despesas, o saldo final
  e o rodapé legal, e com a etiqueta "Dados preliminares" quando a situação for preliminar

#### Scenario: Serventia com a opção desligada

- **WHEN** o cidadão abre o PDF de um boletim de uma serventia com a opção desligada
- **THEN** o PDF não mostra arrecadação, despesas nem saldo

#### Scenario: Isolamento por tenant

- **WHEN** a rota do PDF é chamada com id de boletim de outro tenant
- **THEN** responde 404

### Requirement: Valores recolhidos por fundo

O formulário do boletim SHALL receber, além de mês e ano, os atos praticados, um valor recolhido no
mês para cada fundo da UF da serventia e o valor de ISS recolhido no mês. Os campos dos fundos
SHALL usar os mesmos nomes das colunas da tabela de emolumentos da UF (no RN: FDJ, FRMP, FCRCPN e
FUNAF). Esses valores SHALL ser obrigatórios, aceitar zero e ser tratados como inteiros em
centavos. O formulário NÃO SHALL ter campo de total de tributos: o total SHALL ser a soma dos fundos
e do ISS, calculada no núcleo.

#### Scenario: Serventia do RN abre o formulário

- **WHEN** a operadora de uma serventia do RN abre a aba Boletim mensal
- **THEN** vê os campos Atos praticados, FDJ, FRMP, FCRCPN, FUNAF e ISS, e nenhum campo de total de
  tributos

#### Scenario: Fundo sem recolhimento no mês

- **WHEN** a operadora informa 0,00 em FUNAF e publica
- **THEN** o boletim é aceito e o FUNAF aparece com R$ 0,00

#### Scenario: Campo em branco

- **WHEN** a operadora deixa o campo FRMP vazio e tenta publicar
- **THEN** o boletim não é salvo e o campo FRMP mostra o erro de valor inválido

#### Scenario: Centavos exatos

- **WHEN** os valores têm centavos
- **THEN** subtotais, totais e saldo são exatos em centavos, sem erro de ponto flutuante

### Requirement: Classificação dos fundos em rubricas do CNJ

Cada fundo SHALL pertencer a uma das rubricas do art. 6º, § 3º, da Res. CNJ 215/2015 (redação da
Res. CNJ 670/2025), segundo um mapa por UF mantido no núcleo: I Emolumentos (parcela pública), II
Fundo de Reaparelhamento da Justiça, III Fundo de Compensação, IV Outros Fundos Especiais. No RN o
mapa SHALL ser FDJ → II, FCRCPN → III, FRMP → IV e FUNAF → IV. Uma rubrica sem fundo na UF NÃO SHALL
ser exibida. A classificação SHALL ser aplicada na exibição, a partir do fundo gravado, e não
gravada junto com o valor.

#### Scenario: Agrupamento no RN

- **WHEN** um boletim do RN tem FDJ 1.234,56, FCRCPN 210,40, FRMP 321,00 e FUNAF 98,10
- **THEN** a pré-visualização e o PDF mostram II com FDJ 1.234,56, III com FCRCPN 210,40 e IV com
  subtotal 419,10 (FRMP 321,00 e FUNAF 98,10), mais o total recolhido aos fundos, R$ 1.864,06

#### Scenario: Rubrica sem fundo na UF

- **WHEN** um boletim do RN é exibido
- **THEN** a rubrica I, Emolumentos (parcela pública), não aparece

### Requirement: ISS em linha própria

O ISS SHALL aparecer numa linha própria, fora das rubricas do CNJ, identificado como tributo
municipal e com o nome do município da serventia. O ISS NÃO SHALL entrar no subtotal de nenhuma
rubrica nem no total recolhido aos fundos. O valor exibido SHALL ser o digitado; a alíquota de ISS
da serventia NÃO SHALL ser usada no boletim.

#### Scenario: ISS no boletim de Canguaretama

- **WHEN** a serventia de Canguaretama publica um boletim com ISS 612,00
- **THEN** o boletim mostra "ISS, tributo municipal (Canguaretama)" com R$ 612,00, separado das
  rubricas, e o total recolhido aos fundos não inclui esse valor

### Requirement: Opção de publicar arrecadação, despesas e saldo

A aba Boletim mensal SHALL oferecer a opção "Publicar também arrecadação, despesas e saldo", que
vale para todos os boletins da serventia. Quando a serventia nunca salvou a opção, ela SHALL estar
ligada. Com a opção ligada, o formulário SHALL pedir arrecadação do mês e despesas, ambas
obrigatórias; a pré-visualização e o PDF SHALL mostrar arrecadação, despesas e o saldo. Com a opção
desligada, esses campos NÃO SHALL aparecer no formulário, e a pré-visualização e o PDF de todos os
meses NÃO SHALL mostrar arrecadação, despesas nem saldo, inclusive de boletins publicados antes com
a opção ligada. A opção SHALL ser gravada no servidor no padrão dos demais ajustes da serventia, com
auditoria.

#### Scenario: Serventia que nunca mexeu na opção

- **WHEN** a operadora abre a aba Boletim mensal pela primeira vez
- **THEN** a opção aparece ligada e o formulário pede arrecadação e despesas

#### Scenario: Desligar a opção

- **WHEN** a operadora desliga a opção
- **THEN** a alteração consta na auditoria, os campos de arrecadação e despesas somem do formulário,
  e o PDF de qualquer mês já publicado deixa de mostrar arrecadação, despesas e saldo

#### Scenario: Religar a opção sem os valores de um mês

- **WHEN** a opção é religada e um boletim foi publicado enquanto ela estava desligada
- **THEN** o PDF desse mês mostra só a parte obrigatória, sem arrecadação, despesas nem saldo, até
  o mês ser publicado de novo com esses valores

### Requirement: Aviso sobre a parcela privada

A seção do boletim na página pública de transparência SHALL exibir um aviso fixo informando que a
parcela privada dos emolumentos e as demais receitas e despesas da serventia podem ser solicitadas
por terceiro legitimamente interessado, mediante requerimento administrativo fundamentado
encaminhado à Corregedoria-Geral de Justiça, observada a LGPD. O aviso SHALL aparecer mesmo quando
não houver boletim publicado.

#### Scenario: Cidadão abre a transparência sem boletins

- **WHEN** o cidadão acessa `/transparencia` de uma serventia sem nenhum boletim publicado
- **THEN** vê o estado vazio do boletim e, junto dele, o aviso sobre o acesso à parcela privada pela
  Corregedoria

### Requirement: Boletins no formato anterior

O site SHALL continuar mostrando no formato em que foi publicado o boletim gravado antes desta
mudança, sem valores por fundo e com o total de tributos num valor só: atos praticados, o total de
tributos pagos com a lista dos fundos e do ISS que ele reúne e, com a opção de publicar arrecadação,
despesas e saldo ligada, a arrecadação, as despesas e o saldo calculado como
`arrecadação − tributos − despesas`. O PDF SHALL trazer uma nota dizendo que o boletim foi publicado
antes da Res. CNJ 670/2025, com os tributos num valor só. Publicar de novo o mesmo mês no formato
novo SHALL substituir o boletim antigo e apagar o total de tributos antigo da linha.

#### Scenario: Cidadão abre um boletim antigo

- **WHEN** o cidadão abre o PDF de um boletim de janeiro/2025 publicado antes desta mudança, numa
  serventia com a opção ligada
- **THEN** recebe o PDF com atos, arrecadação, tributos pagos num valor só, despesas, o saldo e a
  nota de formato anterior, e não um erro

#### Scenario: Boletim antigo com a opção desligada

- **WHEN** a opção de publicar arrecadação, despesas e saldo está desligada
- **THEN** o PDF do boletim antigo mostra só atos praticados e o total de tributos pagos

#### Scenario: Republicar um mês antigo no formato novo

- **WHEN** a operadora publica janeiro/2025 no formato novo, com os valores por fundo
- **THEN** o PDF de janeiro/2025 passa a sair agrupado por rubrica, e a linha não guarda mais o
  total de tributos antigo


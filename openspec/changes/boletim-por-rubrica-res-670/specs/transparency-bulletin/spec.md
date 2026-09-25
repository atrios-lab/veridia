## ADDED Requirements

### Requirement: Valores recolhidos por fundo

O formulário do boletim SHALL receber mês, ano, atos praticados, um valor recolhido no mês para
cada fundo da UF da serventia e o valor de ISS recolhido no mês. Os campos dos fundos SHALL usar os
mesmos nomes das colunas da tabela de emolumentos da UF (no RN: FDJ, FRMP, FCRCPN e FUNAF). Todos
os valores SHALL ser obrigatórios, aceitar zero e ser tratados como inteiros em centavos. O
formulário NÃO SHALL ter campo de arrecadação bruta, despesas ou saldo.

#### Scenario: Serventia do RN abre o formulário

- **WHEN** a operadora de uma serventia do RN abre a aba Boletim mensal
- **THEN** vê os campos Atos praticados, FDJ, FRMP, FCRCPN, FUNAF e ISS, e nenhum campo de
  arrecadação bruta, despesas ou saldo

#### Scenario: Fundo sem recolhimento no mês

- **WHEN** a operadora informa 0,00 em FUNAF e publica
- **THEN** o boletim é aceito e o FUNAF aparece com R$ 0,00

#### Scenario: Campo em branco

- **WHEN** a operadora deixa o campo FRMP vazio e tenta publicar
- **THEN** o boletim não é salvo e o campo FRMP mostra o erro de valor inválido

#### Scenario: Centavos exatos

- **WHEN** os valores têm centavos
- **THEN** subtotais e total são exatos em centavos, sem erro de ponto flutuante

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

## MODIFIED Requirements

### Requirement: Pré-visualização fiel ao site

Ao lado do formulário o painel SHALL mostrar a pré-visualização do boletim exatamente como sai no
site: cabeçalho com a marca do tenant e CNS, título "Boletim Mensal, <Mês> de <Ano>", período, atos
praticados, as rubricas com o subtotal e o detalhe por fundo, o total recolhido aos fundos, a linha
do ISS à parte e o rodapé legal. O rodapé SHALL citar o art. 6º, § 3º, da Res. CNJ 215/2015, com a
redação da Res. CNJ 670/2025. A pré-visualização NÃO SHALL mostrar arrecadação bruta, despesas nem
saldo.

#### Scenario: Preview acompanha o formulário

- **WHEN** a operadora altera qualquer valor ou o mês
- **THEN** a pré-visualização reflete a mudança imediatamente, incluindo subtotais e total

#### Scenario: Rodapé cita a norma

- **WHEN** a operadora olha o rodapé da pré-visualização
- **THEN** vê a referência ao art. 6º, § 3º, da Res. CNJ 215/2015, com a redação da Res. CNJ
  670/2025

### Requirement: PDF público com a marca do tenant

Cada boletim publicado SHALL existir como PDF gerado pelo servidor com a identidade do tenant
(mesma infra dos demais PDFs do produto), acessível ao cidadão pela página /transparencia sem chave
nem login. O conteúdo do PDF SHALL ser o mesmo da pré-visualização.

#### Scenario: Cidadão abre o boletim

- **WHEN** o cidadão clica num boletim em /transparencia
- **THEN** recebe o PDF com o cabeçalho do cartório, os atos praticados, as rubricas com o detalhe
  por fundo, o total recolhido aos fundos, a linha do ISS e o rodapé legal, sem arrecadação bruta,
  despesas nem saldo, e com a etiqueta "Dados preliminares" quando a situação for preliminar

#### Scenario: Isolamento por tenant

- **WHEN** a rota do PDF é chamada com id de boletim de outro tenant
- **THEN** responde 404

## REMOVED Requirements

### Requirement: Saldo calculado, nunca digitado

**Reason**: O saldo final (arrecadação − tributos − despesas) é, na prática, a remuneração do
titular, que a Res. CNJ 670/2025 (§ 3º-B) deixa fora do site: só é acessível a terceiro
interessado por requerimento à Corregedoria. A arrecadação bruta e as despesas de custeio saem com
ele, porque também são parcela privada e porque, se ficassem, o saldo continuaria calculável.

**Migration**: Substituído por "Valores recolhidos por fundo". Nenhuma serventia publicou boletim,
então não há registro a converter.

# official-portals

## ADDED Requirements

### Requirement: Centrais agrupadas por atribuição do tenant

A página `/centrais` SHALL listar as centrais nacionais oficiais agrupadas por atribuição, exibindo apenas os grupos cujas atribuições o tenant possui. O catálogo de centrais (nome, descrição, domínio, URL, atribuições) SHALL viver em núcleo puro (`src/core`), nunca hardcoded na página. A página SHALL estar sob `requireSection("centrais-contato")`.

#### Scenario: Tenant com todas as atribuições

- **WHEN** o cidadão abre `/centrais` numa serventia com RCPN, NOTAS, RI, PROTESTO, RTD e RCPJ
- **THEN** vê os grupos Registro Civil (CRC Nacional / Meu Registro Civil), Tabelionato de Notas (e-Notariado, CENSEC), Protesto de Títulos (CENPROT), Registro de Imóveis (ONR / SREI) e Títulos e Documentos · Pessoas Jurídicas (RTDPJ Brasil), cada um com divisor de rótulo em caixa alta

#### Scenario: Tenant sem uma atribuição

- **WHEN** a serventia não possui a atribuição RI
- **THEN** o grupo Registro de Imóveis não aparece na página

### Requirement: Domínio oficial visível em cada cartão

Cada cartão de central SHALL exibir o domínio oficial de destino em um chip com ícone de cadeado, além do nome e de uma descrição em linguagem cidadã. O link SHALL apontar para o site oficial (`https://` + domínio) e abrir em nova aba com `rel="noopener"`.

#### Scenario: Cidadão confere o endereço antes do clique

- **WHEN** o cidadão vê o cartão "e-Notariado"
- **THEN** o chip mostra "e-notariado.org.br" com cadeado, e o clique abre esse domínio em nova aba

### Requirement: Faixa de confiança e SERP em destaque

A página SHALL exibir, antes dos grupos: uma faixa de confiança afirmando que todos os links levam a sites oficiais e que o cartório nunca pede senha nem pagamento fora deles; e o SERP destacado em cartão escuro como "Portal único", com seu domínio (`serp.onr.org.br`) visível. Ambos SHALL aparecer para qualquer tenant com a seção habilitada.

#### Scenario: Faixa e destaque presentes

- **WHEN** o cidadão abre `/centrais`
- **THEN** vê a faixa de confiança com ícone de escudo e, em seguida, o cartão escuro do SERP com o selo "Portal único" e o botão com o domínio

### Requirement: Saída para quem não achou a central

Após os grupos, a página SHALL oferecer um cartão de apoio orientando quem não encontrou o que precisa a pedir direto ao cartório (link para `/solicitar`) ou falar pelo atendimento/contato da serventia.

#### Scenario: Nada se encaixa

- **WHEN** o cidadão percorre os grupos e não encontra seu caso
- **THEN** o cartão final oferece link para solicitar o serviço direto ao cartório

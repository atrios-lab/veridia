# public-site-foundation

## Purpose

TBD

## Requirements

### Requirement: Tema do site público por configuração do tenant
O site público DEVE (SHALL) renderizar com a marca do tenant resolvido pelo host, mantendo
estrutura, layout e jornada idênticos entre tenants. A configuração do tenant nomeia um dos
temas oferecidos (paleta mais serifada); cadastrar serventia DEVE (SHALL) ser escolher um tema,
nunca escrever CSS. Nenhuma cor DEVE (SHALL) ser codificada fora do bloco de tema da folha de
estilo: os componentes usam apenas tokens.

#### Scenario: Dois hosts, duas marcas, mesma estrutura
- **WHEN** a mesma rota pública é servida para `marinho.localhost` e para o host do tenant `aurora`
- **THEN** cada resposta usa a paleta e a serifada do seu tenant, com o mesmo HTML estrutural

#### Scenario: Fonte serifada por enum
- **WHEN** o tenant configura uma das cinco serifadas suportadas (Spectral, Libre Baskerville, Lora, Bitter, Cormorant Garamond)
- **THEN** os títulos do site público renderizam nessa fonte, e o corpo permanece em Public Sans

### Requirement: Shell público com navegação gated
Toda página pública DEVE (SHALL) compartilhar cabeçalho (selo, nome e subtítulo do tenant, navegação)
e rodapé (navegação secundária e texto legal do tenant). Itens de navegação e atalhos DEVEM (SHALL)
aparecer somente quando a seção correspondente está habilitada para o tenant
(`enabledSections`); esconder o item não substitui a checagem de gating no servidor da rota.

#### Scenario: Seção desabilitada some da navegação
- **WHEN** o tenant tem uma seção desabilitada (ex.: `ouvidoria` em `disabledSections`)
- **THEN** nenhum link para essa seção aparece no cabeçalho, rodapé ou blocos da home

#### Scenario: Mobile-first
- **WHEN** qualquer página pública é aberta em viewport 390px
- **THEN** o conteúdo renderiza sem overflow horizontal e com as ações principais acessíveis

### Requirement: Admin fora do tema do tenant

O painel admin DEVE (SHALL) herdar o tema publicado do tenant da sessão, na mesma paleta e
serifada que o site público dele já usa — a estética da plataforma deixou de ser fixa.

#### Scenario: Admin tematizado pelo tenant

- **WHEN** um operador abre qualquer rota `/admin` em um host de tenant
- **THEN** a página usa os tokens de marca (`--brand-*`) daquele tenant, resolvidos pelo
  `data-theme` aplicado na raiz do layout do painel

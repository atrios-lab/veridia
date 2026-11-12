## MODIFIED Requirements

### Requirement: Admin fora do tema do tenant

O painel admin NÃO DEVE (SHALL NOT) herdar o tema publicado do tenant. O tema por serventia
(paleta e serifada) vale para o site público; o painel usa o tema neutro da plataforma, com a
sua própria raiz de layout e a sua própria folha de estilo.

#### Scenario: Admin não tematizado pelo tenant

- **WHEN** um operador abre qualquer rota `/admin` em um host de tenant
- **THEN** a página não usa os tokens de marca (`--brand-*`) daquele tenant e a raiz do layout
  do painel não carrega `data-theme`

#### Scenario: Site público segue tematizado

- **WHEN** um visitante abre a home do mesmo host
- **THEN** a página usa a paleta e a serifada do estilo publicado daquela serventia, como antes

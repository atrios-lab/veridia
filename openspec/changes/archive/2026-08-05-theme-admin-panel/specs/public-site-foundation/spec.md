## MODIFIED Requirements

### Requirement: Admin fora do tema do tenant

O painel admin DEVE (SHALL) herdar o tema publicado do tenant da sessão, na mesma paleta e
serifada que o site público dele já usa — a estética da plataforma deixou de ser fixa.

#### Scenario: Admin tematizado pelo tenant

- **WHEN** um operador abre qualquer rota `/admin` em um host de tenant
- **THEN** a página usa os tokens de marca (`--brand-*`) daquele tenant, resolvidos pelo
  `data-theme` aplicado na raiz do layout do painel

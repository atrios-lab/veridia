## MODIFIED Requirements

### Requirement: Tela de login com identidade da serventia

O sistema SHALL exibir, em `/admin/login`, um painel institucional com o selo, o nome e o
subtítulo da serventia resolvida pelo domínio, ao lado do formulário de e-mail e senha. A
aparência do painel (cores, tipografia) SHALL herdar o tema de marca publicado pela serventia —
o mesmo `data-theme` que o site público dela usa — em vez de uma estética fixa da plataforma.

#### Scenario: Visita não autenticada a /admin/login

- **WHEN** uma pessoa sem sessão válida acessa `/admin/login`
- **THEN** o sistema mostra o selo, nome e subtítulo da serventia do domínio atual, e o
  formulário de e-mail e senha, sem nenhum aviso de erro ou de sessão

#### Scenario: Duas serventias, temas diferentes

- **WHEN** `/admin/login` é aberto em domínios de duas serventias com temas de marca diferentes
- **THEN** as cores e a tipografia do painel de login variam conforme o tema publicado de cada
  uma; o selo, o nome e o subtítulo já variavam antes

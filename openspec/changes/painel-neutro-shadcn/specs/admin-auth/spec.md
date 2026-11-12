## MODIFIED Requirements

### Requirement: Tela de login com identidade da serventia

O sistema SHALL exibir, em `/admin/login`, um painel institucional com o selo, o nome e o
subtítulo da serventia resolvida pelo domínio, ao lado do formulário de e-mail e senha. A
aparência da tela (cores, tipografia) SHALL ser a do tema neutro do painel, igual em toda
serventia: a tela NÃO SHALL herdar o tema de marca publicado pela serventia nem aplicar o
`data-theme` dela. O selo, o nome e o subtítulo são o que identifica a serventia.

#### Scenario: Visita não autenticada a /admin/login

- **WHEN** uma pessoa sem sessão válida acessa `/admin/login`
- **THEN** o sistema mostra o selo, nome e subtítulo da serventia do domínio atual, e o
  formulário de e-mail e senha, sem nenhum aviso de erro ou de sessão

#### Scenario: Duas serventias, temas diferentes

- **WHEN** `/admin/login` é aberto em domínios de duas serventias com temas de marca diferentes
- **THEN** as cores e a tipografia da tela são as mesmas nas duas; o selo, o nome e o subtítulo
  variam conforme a serventia

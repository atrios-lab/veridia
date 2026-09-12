## MODIFIED Requirements

### Requirement: Tela de login com identidade da serventia

O sistema SHALL exibir, em `/admin/login`, um painel institucional com o selo, o nome e o
subtítulo da serventia resolvida pelo domínio, ao lado do formulário de e-mail e senha. A
aparência do painel (cores, tipografia) SHALL herdar o tema de marca publicado pela serventia,
o mesmo `data-theme` que o site público dela usa, em vez de uma estética fixa da plataforma.
Os tons de texto apagado sobre o fundo escuro do painel SHALL derivar do tema, nunca de uma cor
fixa, e SHALL atingir contraste mínimo de 4,5:1 em cada tema oferecido, em `/admin/login` e em
`/admin/esqueci-senha`.

#### Scenario: Visita não autenticada a /admin/login

- **WHEN** uma pessoa sem sessão válida acessa `/admin/login`
- **THEN** o sistema mostra o selo, nome e subtítulo da serventia do domínio atual, e o
  formulário de e-mail e senha, sem nenhum aviso de erro ou de sessão

#### Scenario: Duas serventias, temas diferentes

- **WHEN** `/admin/login` é aberto em domínios de duas serventias com temas de marca diferentes
- **THEN** as cores e a tipografia do painel de login variam conforme o tema publicado de cada
  uma; o selo, o nome e o subtítulo já variavam antes

#### Scenario: Texto apagado legível no tema mais claro

- **WHEN** `/admin/login` ou `/admin/esqueci-senha` é aberto no domínio de uma serventia com o
  tema `oliva-terracota`
- **THEN** a linha de rodapé do painel passa no contraste mínimo e a varredura de
  acessibilidade não acusa violação

## MODIFIED Requirements

### Requirement: Casca do painel com identidade da serventia e estética fixa

Toda tela autenticada do painel SHALL ser renderizada dentro de uma casca composta por barra
lateral e cabeçalho. A barra lateral SHALL exibir o selo da serventia em versão para fundo
claro (`logos.seal.light`), o nome da serventia e o rótulo "Painel administrativo". As cores e
a tipografia da casca SHALL vir do tema neutro do painel, o mesmo em toda serventia: a casca
NÃO SHALL resolver o tema de marca (`--brand-*`) nem aplicar o `data-theme` da serventia. O
selo e o nome são a única marca da serventia na casca.

A barra lateral SHALL ter fundo claro com tinta do navy da plataforma e uma borda que a separa
do conteúdo. O rótulo de um item de navegação que não cabe em uma linha SHALL quebrar em duas,
sem ser cortado com reticências.

#### Scenario: Serventia identificada na sidebar

- **WHEN** um usuário autenticado abre qualquer tela do painel
- **THEN** a sidebar mostra o selo da serventia resolvida pelo host, o nome dela e "Painel
  administrativo"

#### Scenario: Tema do tenant não pinta o painel

- **WHEN** a serventia resolvida tem tema diferente de `verde-dourado`
- **THEN** a casca do painel tem as mesmas cores e a mesma letra que teria em qualquer outra
  serventia, e a raiz de `/admin` não carrega `data-theme`

#### Scenario: Rótulo longo aparece inteiro

- **WHEN** a navegação lista "Solicitação de papéis de segurança"
- **THEN** o rótulo aparece completo, em duas linhas, e o ícone fica alinhado à primeira

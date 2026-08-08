## MODIFIED Requirements

### Requirement: Casca do painel com identidade da serventia e estética fixa

Toda tela autenticada do painel SHALL ser renderizada dentro de uma casca composta por sidebar
institucional e cabeçalho. A sidebar SHALL exibir o selo da serventia em versão para fundo
escuro (`logos.seal.dark`), o nome da serventia e o rótulo "Painel administrativo". As cores e a
tipografia da casca SHALL vir dos tokens `--color-admin-*`, que passam a resolver o tema de marca
(`--brand-*`) publicado pela serventia da sessão — a mesma paleta e serifada que o site público
dela já usa. Cores de estado (erro, aviso, sucesso, campo somente-leitura) permanecem fixas.

#### Scenario: Serventia identificada na sidebar

- **WHEN** um usuário autenticado abre qualquer tela do painel
- **THEN** a sidebar mostra o selo da serventia resolvida pelo host, o nome dela e "Painel
  administrativo"

#### Scenario: Tema do tenant pinta o painel

- **WHEN** a serventia resolvida tem tema diferente de `verde-dourado`
- **THEN** a casca do painel usa a paleta e a serifada daquele tema, resolvidas pelo `data-theme`
  aplicado na raiz de `/admin`

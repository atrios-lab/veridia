# admin-shell

## Purpose

TBD

## Requirements

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

### Requirement: Navegação só oferece o que existe e o que a pessoa pode acessar

A navegação da sidebar SHALL listar apenas rotas do painel que existem no aplicativo, agrupadas
sob rótulos de seção. Um item cuja rota exija permissão que o papel da sessão não tem SHALL ser
omitido. A omissão do item NÃO SHALL ser tratada como controle de acesso: a rota correspondente
SHALL checar a permissão no servidor de qualquer forma.

O destaque de página atual SHALL refletir a rota em que a pessoa está a cada navegação, inclusive
nas navegações feitas no cliente entre telas que compartilham a mesma casca, sem depender de
recarregamento da página.

#### Scenario: Item da tela atual em destaque

- **WHEN** o usuário está em `/admin/configuracoes`
- **THEN** o item "Configurações" aparece marcado como página atual (`aria-current="page"`) e os
  demais não

#### Scenario: Destaque acompanha navegação no cliente

- **WHEN** o usuário está em `/admin/pedidos` e clica no item "Publicações" da sidebar, sem
  recarregar a página
- **THEN** "Publicações" passa a ser o único item marcado como página atual, e "Pedidos de
  serviço" deixa de estar marcado

#### Scenario: Rota inexistente não vira item de menu

- **WHEN** a sidebar é renderizada e a tela "Pedidos de serviço" ainda não existe no aplicativo
- **THEN** nenhum item de menu aponta para ela

#### Scenario: Esconder o item não substitui a checagem

- **WHEN** um usuário com papel `staff` navega diretamente para uma rota que exige `user.manage`,
  sem o item correspondente na sidebar
- **THEN** a própria rota recusa o acesso no servidor

### Requirement: Cabeçalho da tela e rodapé de usuário

O cabeçalho SHALL exibir o título da tela atual e a data corrente por extenso, em português, no
fuso da serventia. O rodapé da sidebar SHALL exibir as iniciais do usuário, seu nome, seu papel
em português e a ação "Sair".

O atalho "Trocar senha" previsto no design NÃO SHALL ser renderizado enquanto a tela de troca de
senha dentro do painel não existir: `/admin/redefinir-senha` é a tela de convite e devolve ao
painel quem já tem sessão. Vale aqui a mesma regra da navegação — link que não leva a lugar
nenhum é pior que link ausente.

#### Scenario: Data no fuso da serventia

- **WHEN** o servidor está em UTC e são 21h30 de 5 de agosto de 2026 em `America/Sao_Paulo`
- **THEN** o cabeçalho mostra "Quarta, 5 de agosto de 2026", não o dia seguinte

#### Scenario: Sair encerra a sessão

- **WHEN** o usuário aciona "Sair" no rodapé da sidebar
- **THEN** a sessão é encerrada no servidor e a pessoa volta ao login com o aviso de saída

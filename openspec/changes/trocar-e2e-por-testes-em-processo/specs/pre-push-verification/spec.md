## MODIFIED Requirements

### Requirement: E2e roda no push, nao durante a implementacao
O repositório SHALL rodar a verificação rápida (`pnpm typecheck`, `pnpm lint`, `pnpm test`)
automaticamente no momento do `git push`, por meio de um hook de `pre-push` versionado. Essa
verificação SHALL ser a mesma que o CI roda como gate e a mesma que se roda localmente durante uma
tarefa; nenhum passo do fluxo SHALL rodar uma suíte de browser.

#### Scenario: Push com suite verde
- **WHEN** a pessoa roda `git push` com o hook instalado e typecheck, lint e test passam
- **THEN** a saída dos três aparece no terminal e o push segue normalmente

#### Scenario: Push com suite vermelha
- **WHEN** a pessoa roda `git push` com o hook instalado e algum dos três passos falha
- **THEN** o hook termina com código diferente de zero, o git aborta o push e nenhum commit chega
  ao remoto

#### Scenario: Implementacao em andamento
- **WHEN** a pessoa edita ou commita durante a implementação
- **THEN** nada roda automaticamente; a pessoa roda `pnpm test` (ou um arquivo só) quando quiser,
  e a rodada inteira termina em segundos

### Requirement: O hook e versionado e instalado por um comando so
O hook SHALL viver no repositório, em `.githooks/pre-push`, e SHALL ser ativado apontando
`core.hooksPath` para esse diretório, sem nenhuma dependência nova de gerenciamento de hooks. O
`package.json` SHALL expor um script que faz essa ativação, e o `README.md` SHALL documentá-lo
dizendo o que o hook roda (typecheck, lint, test), sem citar suíte e2e.

#### Scenario: Clone novo ativa o hook
- **WHEN** alguém clona o repositório e roda o script de instalação de hooks uma vez
- **THEN** `git config core.hooksPath` passa a apontar para `.githooks` e o próximo `git push`
  roda typecheck, lint e test

#### Scenario: Clone sem ativacao
- **WHEN** o script de instalação nunca foi rodado naquele clone
- **THEN** o `git push` funciona como antes, sem rodar nada, e nenhum comando quebra por causa do
  hook ausente

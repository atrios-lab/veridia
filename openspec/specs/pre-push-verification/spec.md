# pre-push-verification Specification

## Purpose
TBD - created by archiving change rodar-e2e-so-no-push. Update Purpose after archive.
## Requirements
### Requirement: E2e roda no push, nao durante a implementacao
O repositorio SHALL rodar a suite e2e (`pnpm e2e`) automaticamente no momento do `git push`, por
meio de um hook de `pre-push` versionado. Nenhum outro passo do fluxo de desenvolvimento SHALL
disparar a suite completa automaticamente.

#### Scenario: Push com suite verde
- **WHEN** a pessoa roda `git push` com o hook instalado e a suite e2e passa
- **THEN** a saida do Playwright aparece no terminal e o push segue normalmente

#### Scenario: Push com suite vermelha
- **WHEN** a pessoa roda `git push` com o hook instalado e algum teste e2e falha
- **THEN** o hook termina com codigo diferente de zero, o git aborta o push e nenhum commit chega
  ao remoto

#### Scenario: Implementacao em andamento
- **WHEN** a pessoa edita, commita ou roda `pnpm test` durante a implementacao
- **THEN** a suite e2e nao e disparada

### Requirement: O hook e versionado e instalado por um comando so
O hook SHALL viver no repositorio, em `.githooks/pre-push`, e SHALL ser ativado apontando
`core.hooksPath` para esse diretorio, sem nenhuma dependencia nova de gerenciamento de hooks. O
`package.json` SHALL expor um script que faz essa ativacao, e o `README.md` SHALL documenta-lo.

#### Scenario: Clone novo ativa o hook
- **WHEN** alguem clona o repositorio e roda o script de instalacao de hooks uma vez
- **THEN** `git config core.hooksPath` passa a apontar para `.githooks` e o proximo `git push`
  roda a suite e2e

#### Scenario: Clone sem ativacao
- **WHEN** o script de instalacao nunca foi rodado naquele clone
- **THEN** o `git push` funciona como antes, sem rodar a suite, e nenhum comando quebra por causa
  do hook ausente

### Requirement: Existe valvula de escape explicita
O hook SHALL ser contornavel por `git push --no-verify`, e essa saida SHALL estar documentada
junto com a instrucao de instalacao.

#### Scenario: Push de rascunho ou emergencia
- **WHEN** a pessoa roda `git push --no-verify`
- **THEN** o hook nao roda e o push sai direto


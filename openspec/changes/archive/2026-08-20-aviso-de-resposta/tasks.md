# Tasks — aviso de resposta

## 1. LGPD

- [x] 1.1 Em `src/app/admin/(dashboard)/lgpd/[protocolo]/actions.ts`, carregar o registro com
      `findById` antes de responder e recusar com mensagem própria quando não existir
- [x] 1.2 Depois de `respondToRecord`, chamar `void notifyCitizen` com o contato e o protocolo
      do registro, assunto e corpo dizendo que há resposta do Encarregado e mandando consultar
      com protocolo e chave — sem o texto da resposta

## 2. Ouvidoria

- [x] 2.1 Em `src/app/admin/(dashboard)/ouvidoria/[protocolo]/actions.ts`, carregar o registro
      com `findById` e recusar quando não existir
- [x] 2.2 Depois de `respondToRecord`, chamar `void notifyCitizen` do mesmo jeito. Sem checagem
      de anonimato na action: `notifyCitizen` já desiste em silêncio quando o contato é nulo ou
      não é e-mail

## 3. Verificação

- [x] 3.1 Teste do núcleo cobrindo a regra de quem recebe: e-mail passa, telefone não passa,
      contato nulo não passa (exercitando `isEmailContact`, que é o portão)
- [x] 3.2 E2E do que é observável: responder um requerimento LGPD e uma manifestação
      identificada **só por telefone**, conferindo que a resposta chega à consulta do cidadão nos
      dois casos. O log de e-mail não é alcançável pelo Playwright (sem mail-catcher) e a
      manifestação anônima nem recebe formulário de resposta no painel — quem recebe o aviso
      fica travado pelo teste do núcleo em 3.1
- [x] 3.3 Rodar o conjunto completo do CI: `pnpm typecheck`, `lint`, `test`, `check:dashes`,
      `check:tokens`, `check:destructive` e `openspec validate --all`

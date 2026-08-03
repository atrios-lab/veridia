## 1. Nucleo

- [x] 1.1 `src/core/auth/roles.ts`: `canAccessTenant(user, tenantSlug)` como funcao pura, recebendo
      apenas o slug do usuario e o da serventia resolvida; slug vazio ou desconhecido nao autoriza
- [x] 1.2 Testes em `node --test`: mesma serventia autoriza; serventia diferente nao; papel de
      administrador **nao** amplia o escopo; escopo certo sem papel nao basta; slug vazio nega

## 2. Banco

- [x] 2.1 `tenant_slug` em `user` no schema Drizzle, obrigatorio
- [x] 2.2 Migracao gerada e **SQL editado a mao**: adicionar anulavel, preencher com a serventia
      padrao, tornar obrigatoria, tudo no mesmo arquivo
- [x] 2.3 Zod do usuario validando o slug contra o registro de serventias, com erro explicito quando
      o slug nao existe
- [x] 2.4 Rodar a migracao contra o PGlite do teste ja existente, conferindo que a linha do usuario
      semeado sobrevive com a serventia preenchida

## 3. Login e painel

- [x] 3.1 Acao de login: apos autenticar, comparar a serventia do usuario com a resolvida pelo host;
      quando nao bate, encerrar a sessao antes de responder
- [x] 3.2 Resposta da recusa identica a de credencial invalida, sem revelar que a conta existe em
      outra serventia
- [x] 3.3 Guarda do painel exigindo papel **e** serventia, no servidor, a cada requisicao
- [x] 3.4 Auditoria da recusa: ator, acao, serventia tentada e data, sem senha nem token

## 4. Seed e configuracao

- [x] 4.1 `ADMIN_SEED_TENANT` no `.env.example`, com `DEFAULT_TENANT` como valor padrao no script
- [x] 4.2 Seed passa a exigir a serventia e recusa slug fora do registro, antes de tocar o banco
- [x] 4.3 README: a serventia do usuario semeado, e que criar usuario para outra serventia e rodar o
      seed com outro `ADMIN_SEED_TENANT`

## 5. Testes de ponta a ponta

- [x] 5.1 Teste afirmando que o usuario de uma serventia nao entra no painel da outra, parametrizado
      sobre o registro, sem caso novo por serventia
- [x] 5.2 Teste afirmando que o cookie devolvido numa recusa nao vale na requisicao seguinte

## 6. Fechamento

- [x] 6.1 Cadeia completa verde: tipos, lint, testes, checks de convencao, build e Playwright
- [ ] 6.2 Conferir em producao que o usuario existente continua entrando na serventia dele e nao
      entra na outra
